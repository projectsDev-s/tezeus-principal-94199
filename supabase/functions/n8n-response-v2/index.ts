import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Feature flags for hardening pipeline
const CORS_ALLOWED_ORIGIN = Deno.env.get('CORS_ALLOWED_ORIGIN') || '*';
const ENFORCE_N8N_SECRET = Deno.env.get('ENFORCE_N8N_SECRET') === 'true';
const ENABLE_MESSAGE_IDEMPOTENCY = Deno.env.get('ENABLE_MESSAGE_IDEMPOTENCY') === 'true';

const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-secret',
};

function generateRequestId(): string {
  return `n8n_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

serve(async (req) => {
  const requestId = generateRequestId();
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST method is allowed',
      requestId
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 🔐 SECURITY: Accept calls from Evolution or N8N (configurable validation)
  const authHeader = req.headers.get('Authorization');
  const secretHeader = req.headers.get('X-Secret');
  const expectedAuth = `Bearer ${Deno.env.get('N8N_WEBHOOK_TOKEN')}`;
  const expectedSecret = 'supabase-evolution-webhook';
  
  // Allow Evolution API calls with X-Secret header OR N8N calls with Authorization header
  const isValidEvolutionCall = secretHeader === expectedSecret;
  const isValidN8NCall = authHeader === expectedAuth;
  
  // Optional enforcement based on feature flag
  if (ENFORCE_N8N_SECRET) {
    if (!isValidEvolutionCall && !isValidN8NCall) {
      console.log(`❌ [${requestId}] Unauthorized access attempt - missing valid auth (enforcement enabled)`);
      return new Response(JSON.stringify({ 
        error: 'Unauthorized', 
        message: 'This endpoint accepts calls from Evolution API (X-Secret) or N8N (Authorization)',
        requestId 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } else if (!isValidEvolutionCall && !isValidN8NCall) {
    console.log(`⚠️ [${requestId}] Unauthorized access but enforcement disabled - continuing`);
  }
  
  const requestSource = isValidEvolutionCall ? 'Evolution API' : 'N8N';
  console.log(`✅ [${requestId}] Authorization verified - request from ${requestSource}`);

  try {
    const payload = await req.json();
    console.log(`📨 [${requestId}] Webhook received from ${requestSource}:`, JSON.stringify(payload, null, 2));

    // If request is from Evolution API, process locally AND forward to N8N
    if (isValidEvolutionCall) {
      console.log(`🔄 [${requestId}] Processing Evolution webhook event`);
      
      // Extract instance name from payload
      const instanceName = payload.instance || payload.instanceName;
      console.log(`📊 [${requestId}] Instance: ${instanceName}, Event: ${payload.event}`);
      
      // Get workspace_id and webhook details from database
      let workspaceId = null;
      let webhookUrl = null;
      let webhookSecret = null;
      let processedData = null;
      
      if (instanceName) {
        // Get workspace_id from connections table
        const { data: connection } = await supabase
          .from('connections')
          .select('workspace_id')
          .eq('instance_name', instanceName)
          .single();

        if (connection) {
          workspaceId = connection.workspace_id;
          
          // Get webhook settings for this workspace
          const { data: webhookSettings } = await supabase
            .from('workspace_webhook_settings')
            .select('webhook_url, webhook_secret')
            .eq('workspace_id', workspaceId)
            .single();

          if (webhookSettings) {
            webhookUrl = webhookSettings.webhook_url;
            webhookSecret = webhookSettings.webhook_secret;
          }
        }
      }

      // If no webhook configured, use fallback
      if (!webhookUrl) {
        webhookUrl = Deno.env.get('N8N_INBOUND_WEBHOOK_URL');
        webhookSecret = Deno.env.get('N8N_WEBHOOK_TOKEN');
      }

      // PROCESS MESSAGE LOCALLY FIRST (Only for inbound messages from contacts)
      if (workspaceId && payload.data?.message && payload.data?.key?.fromMe === false) {
        console.log(`📝 [${requestId}] Processing inbound message locally before forwarding`);
        
        // Extract message data from Evolution webhook
        const messageData = payload.data;
        const phoneNumber = messageData.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
        const evolutionMessageId = messageData.key?.id;
        
        // Check if this message already exists (prevent duplicates)
        const { data: existingMessage } = await supabase
          .from('messages')
          .select('id, conversation_id')
          .eq('external_id', evolutionMessageId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (existingMessage) {
          console.log(`⚠️ [${requestId}] Message already exists, skipping local processing: ${evolutionMessageId}`);
          processedData = {
            message_id: existingMessage.id,
            workspace_id: workspaceId,
            conversation_id: existingMessage.conversation_id,
            instance: instanceName,
            phone_number: phoneNumber.replace(/\D/g, ''),
            duplicate_skipped: true
          };
        } else {
          const messageContent = messageData.message?.conversation || 
                                messageData.message?.extendedTextMessage?.text || 
                                messageData.message?.imageMessage?.caption ||
                                messageData.message?.videoMessage?.caption ||
                                messageData.message?.documentMessage?.caption ||
                                '📎 Arquivo';
          
          const sanitizedPhone = phoneNumber.replace(/\D/g, '');
          
          if (sanitizedPhone && messageContent) {
            // Find or create contact
            let contactId: string;
            const { data: existingContact } = await supabase
              .from('contacts')
              .select('id')
              .eq('phone', sanitizedPhone)
              .eq('workspace_id', workspaceId)
              .maybeSingle();

            if (existingContact) {
              contactId = existingContact.id;
            } else {
              const { data: newContact } = await supabase
                .from('contacts')
                .insert({
                  phone: sanitizedPhone,
                  name: messageData.pushName || sanitizedPhone,
                  workspace_id: workspaceId
                })
                .select('id')
                .single();
              contactId = newContact?.id;
            }

            // 🖼️ Fetch profile image from Evolution API
            console.log(`🖼️ [${requestId}] Attempting to fetch profile image for contact: ${contactId}, phone: ${sanitizedPhone}, workspace: ${workspaceId}`);
            
            try {
              // Get connection secrets for this instance
              const { data: connectionData } = await supabase
                .from('connections')
                .select(`
                  id,
                  instance_name,
                  connection_secrets (
                    token,
                    evolution_url
                  )
                `)
                .eq('instance_name', instance)
                .eq('workspace_id', workspaceId)
                .single();

              if (connectionData?.connection_secrets?.[0]) {
                const { token, evolution_url } = connectionData.connection_secrets[0];
                
                // Fetch profile image from Evolution API
                console.log(`🔗 [${requestId}] Fetching profile from: ${evolution_url}/chat/findProfile/${instance}`);
                
                const profileResponse = await fetch(`${evolution_url}/chat/findProfile/${instance}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': token
                  },
                  body: JSON.stringify({
                    number: sanitizedPhone
                  })
                });

                if (profileResponse.ok) {
                  const profileData = await profileResponse.json();
                  console.log(`✅ [${requestId}] Profile data received:`, JSON.stringify(profileData, null, 2));
                  
                  const profileImageUrl = profileData?.profilePictureUrl || profileData?.picture;
                  
                  if (profileImageUrl && contactId) {
                    console.log(`🖼️ [${requestId}] Found profile image URL: ${profileImageUrl}`);
                    
                    // Call the fetch-whatsapp-profile function
                    const { error: profileError } = await supabase.functions.invoke('fetch-whatsapp-profile', {
                      body: {
                        phone: sanitizedPhone,
                        profileImageUrl: profileImageUrl,
                        contactId: contactId
                      }
                    });

                    if (profileError) {
                      console.error(`❌ [${requestId}] Failed to update profile image for contact ${contactId}, phone ${sanitizedPhone}, workspace ${workspaceId}:`, profileError);
                    } else {
                      console.log(`✅ [${requestId}] Profile image update requested for contact ${contactId}, phone ${sanitizedPhone}, workspace ${workspaceId}`);
                    }
                  } else {
                    console.log(`ℹ️ [${requestId}] No profile image URL found in Evolution API response. ContactId: ${contactId}, ProfileData:`, JSON.stringify(profileData, null, 2));
                  }
                } else {
                  console.error(`❌ [${requestId}] Failed to fetch profile from Evolution API:`, profileResponse.status, await profileResponse.text());
                }
              } else {
                console.log(`⚠️ [${requestId}] No connection secrets found for instance ${instance}`);
              }
            } catch (error) {
              console.error(`❌ [${requestId}] Error fetching profile image for contact ${contactId}, phone ${sanitizedPhone}, workspace ${workspaceId}:`, error.message || error);
            }

            // Get connection_id for proper conversation association
            let resolvedConnectionId = null;
            const { data: connectionData } = await supabase
              .from('connections')
              .select('id')
              .eq('workspace_id', workspaceId)
              .eq('instance_name', instanceName)
              .single();
            
            if (connectionData) {
              resolvedConnectionId = connectionData.id;
            }

            // Find existing conversation for this contact and workspace (any connection)
            let conversationId: string;
            const { data: existingConversation } = await supabase
              .from('conversations')
              .select('id, connection_id')
              .eq('contact_id', contactId)
              .eq('workspace_id', workspaceId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (existingConversation) {
              conversationId = existingConversation.id;
              
              // Update connection_id if it's different (link conversation to current connection)
              if (resolvedConnectionId && existingConversation.connection_id !== resolvedConnectionId) {
                await supabase
                  .from('conversations')
                  .update({ connection_id: resolvedConnectionId })
                  .eq('id', conversationId);
              }
            } else {
              // Create new conversation only if none exists for this contact
              const { data: newConversation } = await supabase
                .from('conversations')
                .insert({
                  contact_id: contactId,
                  workspace_id: workspaceId,
                  connection_id: resolvedConnectionId,
                  status: 'open'
                })
                .select('id')
                .single();
              conversationId = newConversation?.id;

              // 🎯 DISTRIBUIR CONVERSA PARA FILA (se conexão tiver fila configurada)
              if (conversationId && resolvedConnectionId) {
                console.log(`🎯 [${requestId}] Nova conversa criada, iniciando distribuição de fila`);
                
                try {
                  // Buscar queue_id da conexão
                  const { data: connection } = await supabase
                    .from('connections')
                    .select('queue_id')
                    .eq('id', resolvedConnectionId)
                    .single();

                  if (connection?.queue_id) {
                    console.log(`📋 [${requestId}] Conexão vinculada à fila: ${connection.queue_id}`);
                    
                    // Buscar fila e suas configurações
                    const { data: queue } = await supabase
                      .from('queues')
                      .select('id, name, distribution_type, last_assigned_user_index, ai_agent_id')
                      .eq('id', connection.queue_id)
                      .eq('is_active', true)
                      .single();

                    if (queue) {
                      console.log(`🔧 [${requestId}] Fila encontrada: ${queue.name}, tipo: ${queue.distribution_type}`);
                      
                      // Buscar usuários ativos da fila
                      const { data: queueUsers } = await supabase
                        .from('queue_users')
                        .select(`
                          user_id,
                          order_position,
                          system_users!inner(id, status)
                        `)
                        .eq('queue_id', queue.id)
                        .eq('system_users.status', 'active')
                        .order('order_position', { ascending: true });

                      if (queueUsers && queueUsers.length > 0) {
                        console.log(`👥 [${requestId}] ${queueUsers.length} usuários ativos na fila`);
                        
                        let selectedUserId = null;
                        let newIndex = queue.last_assigned_user_index || 0;

                        // Selecionar usuário baseado no tipo de distribuição
                        switch (queue.distribution_type) {
                          case 'sequencial':
                            newIndex = ((queue.last_assigned_user_index || 0) + 1) % queueUsers.length;
                            selectedUserId = queueUsers[newIndex].user_id;
                            console.log(`🔄 [${requestId}] Distribuição sequencial - índice: ${newIndex}, usuário: ${selectedUserId}`);
                            
                            // Atualizar índice para próxima distribuição
                            await supabase
                              .from('queues')
                              .update({ last_assigned_user_index: newIndex })
                              .eq('id', queue.id);
                            break;

                          case 'aleatoria':
                            const randomIndex = Math.floor(Math.random() * queueUsers.length);
                            selectedUserId = queueUsers[randomIndex].user_id;
                            console.log(`🎲 [${requestId}] Distribuição aleatória - índice: ${randomIndex}, usuário: ${selectedUserId}`);
                            break;

                          case 'ordenada':
                            selectedUserId = queueUsers[0].user_id;
                            console.log(`📌 [${requestId}] Distribuição ordenada - primeiro usuário: ${selectedUserId}`);
                            break;

                          case 'nao_distribuir':
                            console.log(`⏸️ [${requestId}] Fila configurada para não distribuir automaticamente`);
                            break;

                          default:
                            console.log(`⚠️ [${requestId}] Tipo de distribuição desconhecido: ${queue.distribution_type}`);
                        }

                        if (selectedUserId) {
                          // Atualizar conversa com assigned_user_id (ACEITAR AUTOMATICAMENTE)
                          const { error: updateError } = await supabase
                            .from('conversations')
                            .update({
                              assigned_user_id: selectedUserId,
                              assigned_at: new Date().toISOString(),
                              queue_id: connection.queue_id,
                              status: 'open',
                              agente_ativo: queue.ai_agent_id ? true : false
                            })
                            .eq('id', conversationId);

                          if (updateError) {
                            console.error(`❌ [${requestId}] Erro ao atribuir conversa:`, updateError);
                          } else {
                            console.log(`✅ [${requestId}] Conversa ACEITA automaticamente para usuário ${selectedUserId}`);

                            // Registrar atribuição em conversation_assignments
                            await supabase
                              .from('conversation_assignments')
                              .insert({
                                conversation_id: conversationId,
                                to_assigned_user_id: selectedUserId,
                                from_assigned_user_id: null,
                                changed_by: selectedUserId,
                                action: 'assign'
                              });

                            console.log(`📝 [${requestId}] Atribuição registrada: fila ${queue.name} → usuário ${selectedUserId}`);
                          }
                        }
                      } else {
                        console.log(`⚠️ [${requestId}] Fila ${queue.name} não possui usuários ativos`);
                      }
                    } else {
                      console.log(`ℹ️ [${requestId}] Fila ${connection.queue_id} não está ativa`);
                    }
                  } else {
                    console.log(`ℹ️ [${requestId}] Conexão não está vinculada a nenhuma fila`);
                  }
                } catch (error) {
                  console.error(`❌ [${requestId}] Erro ao processar distribuição de fila (não-bloqueante):`, error);
                }
              }
            }

            // Create message with Evolution message ID as external_id
            const messageId = crypto.randomUUID();
            const { data: newMessage } = await supabase
              .from('messages')
              .insert({
                id: messageId,
                conversation_id: conversationId,
                workspace_id: workspaceId,
                content: messageContent,
                message_type: messageData.message?.imageMessage ? 'image' : 
                             messageData.message?.videoMessage ? 'video' :
                             messageData.message?.documentMessage ? 'document' : 'text',
                sender_type: 'contact',
                status: 'received',
                origem_resposta: 'automatica',
                external_id: evolutionMessageId,
                metadata: {
                  source: 'evolution-webhook-v2',
                  evolution_data: messageData,
                  request_id: requestId,
                  message_flow: 'inbound_original'
                }
              })
              .select('id')
              .single();

            // Update conversation timestamp
            await supabase
              .from('conversations')
              .update({ 
                last_activity_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', conversationId);

            processedData = {
              message_id: messageId,
              workspace_id: workspaceId,
              conversation_id: conversationId,
              contact_id: contactId,
              connection_id: resolvedConnectionId,
              instance: instanceName,
              phone_number: sanitizedPhone
            };

            console.log(`✅ [${requestId}] Inbound message processed locally:`, processedData);
          }
        }
      } else if (workspaceId && payload.data?.key?.fromMe === true) {
        console.log(`📤 [${requestId}] Outbound message detected, skipping local processing (will be handled by N8N response)`);
      }

      // Forward to N8N with processed data
      if (webhookUrl) {
        console.log(`🚀 [${requestId}] Forwarding to N8N: ${webhookUrl}`);
        
        const headers = {
          'Content-Type': 'application/json',
        };
        
        if (webhookSecret) {
          headers['Authorization'] = `Bearer ${webhookSecret}`;
        }

        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...payload,
              workspace_id: workspaceId,
              source: 'evolution-api',
              forwarded_by: 'n8n-response-v2',
              request_id: requestId,
              processed_data: processedData
            })
          });

          console.log(`✅ [${requestId}] N8N webhook called successfully, status: ${response.status}`);
          
        } catch (error) {
          console.error(`❌ [${requestId}] Error calling N8N webhook:`, error);
        }
      }

      // Always return processed data or basic structure  
      return new Response(JSON.stringify({
        success: true,
        action: 'processed_and_forwarded',
        message_id: processedData?.message_id || crypto.randomUUID(),
        workspace_id: processedData?.workspace_id || workspaceId,
        conversation_id: processedData?.conversation_id,
        contact_id: processedData?.contact_id,
        connection_id: processedData?.connection_id,
        instance: processedData?.instance,
        phone_number: processedData?.phone_number,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // N8N Response Processing - Only process if from N8N
    console.log(`🎯 [${requestId}] Processing N8N response payload`);
    console.log(`📋 [${requestId}] Full payload structure:`, JSON.stringify(payload, null, 2));
    console.log(`🔍 [${requestId}] Auth header: ${authHeader ? 'present' : 'missing'}`);
    console.log(`🔍 [${requestId}] Expected auth: ${expectedAuth}`);
    console.log(`🔍 [${requestId}] Headers:`, Object.fromEntries(req.headers.entries()));
    
    // 🎯 STRICT PAYLOAD VALIDATION - N8N must send normalized payload
    const { 
      direction,           // 'inbound' or 'outbound' 
      external_id,         // Required for message updates
      phone_number,        // Required
      content,            // Required for new messages
      message_type = 'text',
      sender_type,        // 'contact' or 'agent'
      file_url,
      file_name,
      mime_type,
      workspace_id,       // Required for new conversations
      connection_id,      // Optional for inbound
      contact_name,       // Optional
      metadata = {}
    } = payload;
    
    console.log(`📋 [${requestId}] Extracted fields: direction=${direction}, external_id=${external_id}, content="${content}", workspace_id=${workspace_id}`);

    // Validate required fields
    if (!direction || !['inbound', 'outbound'].includes(direction)) {
      console.error(`❌ [${requestId}] Invalid or missing direction: ${direction}`);
      return new Response(JSON.stringify({
        error: 'Invalid direction',
        message: 'direction must be "inbound" or "outbound"',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!phone_number) {
      console.error(`❌ [${requestId}] Missing phone_number`);
      return new Response(JSON.stringify({
        error: 'Missing phone_number',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const sanitizedPhone = sanitizePhoneNumber(phone_number);
    console.log(`📱 [${requestId}] Processing ${direction} message for phone: ${sanitizedPhone}`);

    if (external_id) {
      // UPDATE EXISTING MESSAGE (for N8N responses updating previously created messages)
      console.log(`🔄 [${requestId}] Updating existing message: ${external_id}`);
      
      // Check if this is a duplicate N8N response (same external_id and content)
      const { data: existingMessage, error: findError } = await supabase
        .from('messages')
        .select('id, conversation_id, workspace_id, content, file_url, file_name, mime_type, metadata, sender_type')
        .eq('id', external_id)
        .maybeSingle();

      if (findError) {
        console.error(`❌ [${requestId}] Error finding message:`, findError);
        return new Response(JSON.stringify({
          error: 'Failed to find message',
          details: findError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!existingMessage) {
        console.log(`⚠️ [${requestId}] Message not found for update: ${external_id}, treating as new message`);
        // If no content provided for new message, create placeholder message
        if (!content && !file_url && direction === 'outbound') {
          console.log(`📝 [${requestId}] Creating placeholder message for external_id: ${external_id}`);
          // Set default content for placeholder messages
          content = 'Mensagem em processamento...';
        }
        // Fall through to creation logic
      } else {
        // Check if this is an inbound message being processed again (prevent duplicate processing)
        if (existingMessage.sender_type === 'contact' && direction === 'inbound' && 
            existingMessage.metadata?.message_flow === 'inbound_original') {
          console.log(`⚠️ [${requestId}] Duplicate inbound message detected, skipping: ${external_id}`);
          
          // Get contact_id from conversation
          const { data: conversation } = await supabase
            .from('conversations')
            .select('contact_id')
            .eq('id', existingMessage.conversation_id)
            .single();
          
          return new Response(JSON.stringify({
            success: true,
            action: 'duplicate_skipped',
            message_id: external_id,
            workspace_id: existingMessage.workspace_id,
            conversation_id: existingMessage.conversation_id,
            contact_id: conversation?.contact_id,
            requestId
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update existing message (typically bot responses)
        const updateData: any = {};
        if (content !== undefined) updateData.content = content;
        if (file_url !== undefined) updateData.file_url = file_url;
        if (file_name !== undefined) updateData.file_name = file_name;
        if (mime_type !== undefined) updateData.mime_type = mime_type;
        if (Object.keys(metadata).length > 0) {
          updateData.metadata = { 
            ...existingMessage.metadata, 
            ...metadata,
            message_flow: 'n8n_response_update'
          };
        }

        const { error: updateError } = await supabase
          .from('messages')
          .update(updateData)
          .eq('id', external_id);

        if (updateError) {
          console.error(`❌ [${requestId}] Error updating message:`, updateError);
          return new Response(JSON.stringify({
            error: 'Failed to update message',
            details: updateError.message,
            requestId
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`✅ [${requestId}] Message updated successfully: ${external_id}`);
        
        // Get contact_id from conversation
        const { data: conversation } = await supabase
          .from('conversations')
          .select('contact_id')
          .eq('id', existingMessage.conversation_id)
          .single();
        
        return new Response(JSON.stringify({
          success: true,
          action: 'updated',
          message_id: external_id,
          workspace_id: existingMessage.workspace_id,
          conversation_id: existingMessage.conversation_id,
          contact_id: conversation?.contact_id,
          requestId
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // CREATE NEW MESSAGE - só exigir content se não for atualização e não for outbound com external_id
    if (!content && !file_url && !external_id) {
      console.error(`❌ [${requestId}] Missing content for new message`);
      return new Response(JSON.stringify({
        error: 'Missing content',
        message: 'content, file_url, or external_id is required for messages',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Se não tem content mas tem external_id e é outbound, criar content padrão
    if (!content && !file_url && external_id && direction === 'outbound') {
      content = 'Mensagem em processamento...';
      console.log(`📝 [${requestId}] Using default content for outbound message with external_id`);
    }

    if (!workspace_id) {
      console.error(`❌ [${requestId}] Missing workspace_id for new message`);
      return new Response(JSON.stringify({
        error: 'Missing workspace_id',
        message: 'workspace_id is required for new messages',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check for duplicate messages by external_id before creating new
    if (external_id) {
      const { data: duplicateCheck } = await supabase
        .from('messages')
        .select('id, conversation_id, workspace_id')
        .eq('external_id', external_id)
        .eq('workspace_id', workspace_id)
        .maybeSingle();

      if (duplicateCheck) {
        console.log(`⚠️ [${requestId}] Message with external_id already exists, skipping creation: ${external_id}`);
        
        // Get contact_id from conversation
        const { data: conversation } = await supabase
          .from('conversations')
          .select('contact_id')
          .eq('id', duplicateCheck.conversation_id)
          .single();
        
        return new Response(JSON.stringify({
          success: true,
          action: 'duplicate_prevented',
          message_id: duplicateCheck.id,
          workspace_id: duplicateCheck.workspace_id,
          conversation_id: duplicateCheck.conversation_id,
          contact_id: conversation?.contact_id,
          requestId
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log(`🆕 [${requestId}] Creating new ${direction} message`);

    // Find or create contact
    let contactId: string;
    const { data: existingContact, error: contactFindError } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', sanitizedPhone)
      .eq('workspace_id', workspace_id)
      .maybeSingle();

    if (contactFindError) {
      console.error(`❌ [${requestId}] Error finding contact:`, contactFindError);
      return new Response(JSON.stringify({
        error: 'Failed to find contact',
        details: contactFindError.message,
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (existingContact) {
      contactId = existingContact.id;
      console.log(`✅ [${requestId}] Found existing contact: ${contactId}`);
    } else {
      // Create new contact
      const { data: newContact, error: contactCreateError } = await supabase
        .from('contacts')
        .insert({
          phone: sanitizedPhone,
          name: contact_name || sanitizedPhone,
          workspace_id: workspace_id
        })
        .select('id')
        .single();

      if (contactCreateError) {
        console.error(`❌ [${requestId}] Error creating contact:`, contactCreateError);
        return new Response(JSON.stringify({
          error: 'Failed to create contact',
          details: contactCreateError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      contactId = newContact.id;
      console.log(`✅ [${requestId}] Created new contact: ${contactId}`);
    }

    // Process contact profile image from N8N payload if available
    const profilePictureUrl = payload.profilePictureUrl || 
                              payload.data?.profilePictureUrl ||
                              payload.data?.message?.profilePictureUrl ||
                              payload.contact?.profilePicture ||
                              payload.sender?.profilePicture ||
                              payload.message?.profilePictureUrl;
    
    if (profilePictureUrl && phone_number && workspace_id) {
      console.log(`🖼️ [${requestId}] Profile image URL received from N8N: ${profilePictureUrl}`);
      
      try {
        // Use the new process-profile-image function
        const profileSaveResult = await supabase.functions.invoke('process-profile-image', {
          body: {
            phone: sanitizedPhone,
            profileImageUrl: profilePictureUrl,
            contactId: contactId,
            workspaceId: workspace_id,
            instanceName: payload.instance || 'n8n'
          }
        });

        if (profileSaveResult.error) {
          console.error(`⚠️ [${requestId}] Error saving profile image from N8N:`, profileSaveResult.error);
        } else {
          console.log(`✅ [${requestId}] Profile image saved from N8N payload for`, sanitizedPhone);
        }
      } catch (error) {
        console.error(`⚠️ [${requestId}] Error saving profile image from N8N:`, error);
      }
    } else if (phone_number && contact_name) {
      console.log(`🔍 [${requestId}] No profile image URL in N8N payload, checking if fetch is needed for ${sanitizedPhone}`);
      
      try {
        // Check if contact already has a recent profile image
        const { data: contactData } = await supabase
          .from('contacts')
          .select('profile_image_updated_at, profile_fetch_last_attempt')
          .eq('id', contactId)
          .maybeSingle();

        const now = new Date();
        const lastUpdate = contactData?.profile_image_updated_at ? new Date(contactData.profile_image_updated_at) : null;
        const lastAttempt = contactData?.profile_fetch_last_attempt ? new Date(contactData.profile_fetch_last_attempt) : null;
        
        // Skip if image was updated in the last 24 hours
        const shouldSkipRecent = lastUpdate && (now.getTime() - lastUpdate.getTime()) < 24 * 60 * 60 * 1000;
        // Skip if attempt was made in the last hour
        const shouldSkipAttempt = lastAttempt && (now.getTime() - lastAttempt.getTime()) < 60 * 60 * 1000;
        
        if (shouldSkipRecent) {
          console.log(`⏭️ [${requestId}] Skipping profile image fetch - updated recently for ${sanitizedPhone}`);
        } else if (shouldSkipAttempt) {
          console.log(`⏭️ [${requestId}] Skipping profile image fetch - attempted recently for ${sanitizedPhone}`);
        } else {
          console.log(`🔄 [${requestId}] May need to fetch profile image from Evolution API for ${sanitizedPhone}`);
          // Note: Evolution API fetch would happen via separate background process
        }
      } catch (error) {
        console.error(`⚠️ [${requestId}] Error checking profile image status:`, error);
      }
    }

    // Find existing conversation for this contact and workspace (prioritize reusing any existing conversation)
    let conversationId: string;
    const { data: existingConversation, error: conversationFindError } = await supabase
      .from('conversations')
      .select('id, connection_id')
      .eq('contact_id', contactId)
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conversationFindError) {
      console.error(`❌ [${requestId}] Error finding conversation:`, conversationFindError);
      return new Response(JSON.stringify({
        error: 'Failed to find conversation',
        details: conversationFindError.message,
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (existingConversation) {
      conversationId = existingConversation.id;
      console.log(`✅ [${requestId}] Found existing conversation: ${conversationId}`);
      
      // Update connection_id if provided and different (link conversation to current connection)
      if (connection_id && existingConversation.connection_id !== connection_id) {
        await supabase
          .from('conversations')
          .update({ connection_id: connection_id })
          .eq('id', conversationId);
        console.log(`🔗 [${requestId}] Updated conversation connection_id: ${connection_id}`);
      }
    } else {
      // Create new conversation only if none exists for this contact
      const { data: newConversation, error: conversationCreateError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          workspace_id: workspace_id,
          connection_id: connection_id,
          status: 'open'
        })
        .select('id')
        .single();

      if (conversationCreateError) {
        console.error(`❌ [${requestId}] Error creating conversation:`, conversationCreateError);
        return new Response(JSON.stringify({
          error: 'Failed to create conversation',
          details: conversationCreateError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      conversationId = newConversation.id;
      console.log(`✅ [${requestId}] Created new conversation: ${conversationId}`);
    }

    // Check for system message loop prevention when idempotency is enabled
    if (ENABLE_MESSAGE_IDEMPOTENCY && metadata?.origem_resposta === 'system') {
      console.log(`🔄 [${requestId}] Skipping system message to prevent loop (idempotency enabled)`);
      return new Response(JSON.stringify({
        success: true,
        action: 'skipped_system_message',
        message: 'System message skipped to prevent loop',
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create message with optional idempotency
    const messageData = {
      id: crypto.randomUUID(), // Sempre gerar UUID único para id
      conversation_id: conversationId,
      workspace_id: workspace_id,
      content: content || (file_url ? `📎 ${file_name || 'Arquivo'}` : ''),
      message_type: message_type,
      sender_type: sender_type || (direction === 'inbound' ? 'contact' : 'agent'),
      file_url: file_url || null,
      file_name: file_name || null,
      mime_type: mime_type || null,
      status: direction === 'inbound' ? 'received' : 'sent',
      origem_resposta: direction === 'inbound' ? 'automatica' : 'manual',
      external_id: external_id || crypto.randomUUID(), // external_id separado do id
      metadata: {
        source: 'n8n-response-v2',
        direction: direction,
        request_id: requestId,
        message_flow: direction === 'outbound' ? 'n8n_bot_response' : 'n8n_new_message',
        ...metadata
      }
    };

    // Insert or upsert based on idempotency flag
    let newMessage, messageCreateError;
    
    if (ENABLE_MESSAGE_IDEMPOTENCY && external_id) {
      console.log(`🔄 [${requestId}] Using upsert for idempotency with external_id: ${external_id}`);
      const { data, error } = await supabase
        .from('messages')
        .upsert(messageData, { 
          onConflict: 'workspace_id,external_id',
          ignoreDuplicates: false 
        })
        .select('id')
        .single();
      newMessage = data;
      messageCreateError = error;
    } else {
      console.log(`📝 [${requestId}] Using standard insert (idempotency disabled or no external_id)`);
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select('id')
        .single();
      newMessage = data;
      messageCreateError = error;
    }

    if (messageCreateError) {
      console.error(`❌ [${requestId}] Error creating message:`, messageCreateError);
      return new Response(JSON.stringify({
        error: 'Failed to create message',
        details: messageCreateError.message,
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Message created successfully: ${newMessage.id}`);

    // Update conversation timestamp (triggers will handle unread_count)
    const { error: conversationUpdateError } = await supabase
      .from('conversations')
      .update({ 
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (conversationUpdateError) {
      console.warn(`⚠️ [${requestId}] Failed to update conversation timestamp:`, conversationUpdateError);
    }

    // Get connection details for response
    let instanceInfo = null;
    const finalConnectionId = connection_id || (existingConversation ? existingConversation.connection_id : null);
    if (finalConnectionId) {
      const { data: connectionData } = await supabase
        .from('connections')
        .select('instance_name')
        .eq('id', finalConnectionId)
        .maybeSingle();
      
      if (connectionData) {
        instanceInfo = connectionData.instance_name;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      action: 'created',
      message_id: newMessage.id,
      workspace_id: workspace_id,
      conversation_id: conversationId,
      contact_id: contactId,
      connection_id: finalConnectionId,
      instance: instanceInfo,
      phone_number: phone_number,
      requestId
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
