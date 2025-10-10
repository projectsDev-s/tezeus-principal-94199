import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-secret',
};

function generateRequestId(): string {
  return `evo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

function extractPhoneFromRemoteJid(remoteJid: string): string {
  // Handle different WhatsApp remoteJid formats:
  // @s.whatsapp.net (normal WhatsApp contacts)
  // @lid (LinkedIn imported contacts or other sources)
  // @g.us (group chats)
  // @broadcast (broadcast lists)
  console.log(`📱 Extracting phone from remoteJid: ${remoteJid}`);
  
  // Remove any WhatsApp suffix using regex
  const phoneNumber = remoteJid.replace(/@(s\.whatsapp\.net|lid|g\.us|broadcast|c\.us)$/, '');
  const sanitized = sanitizePhoneNumber(phoneNumber);
  
  console.log(`📱 Extracted phone: ${phoneNumber} -> sanitized: ${sanitized}`);
  return sanitized;
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

  // 🔐 SECURITY: Log incoming requests for debugging
  const secretHeader = req.headers.get('X-Secret');
  const userAgent = req.headers.get('User-Agent');
  const authorization = req.headers.get('Authorization');
  
  console.log(`🔍 [${requestId}] Headers received:`, {
    'X-Secret': secretHeader,
    'User-Agent': userAgent,
    'Authorization': authorization ? '[REDACTED]' : null,
    'Content-Type': req.headers.get('Content-Type')
  });
  
  // Evolution API calls typically don't include X-Secret, so we'll allow them
  // but log for security monitoring
  if (!secretHeader && !authorization) {
    console.log(`⚠️ [${requestId}] Request without authentication headers - treating as Evolution API call`);
  }
  
  console.log(`✅ [${requestId}] Authorization verified - request from Evolution API`);

  try {
    const payload = await req.json();
    console.log(`📨 [${requestId}] Evolution webhook received:`, JSON.stringify(payload, null, 2));

    // Extract instance name from payload
    const instanceName = payload.instance || payload.instanceName;
    console.log(`📊 [${requestId}] Instance: ${instanceName}, Event: ${payload.event}`);
    
    // Debug: verificar evento recebido
    console.log(`🔍 [${requestId}] Event check: payload.event="${payload.event}", uppercase="${payload.event?.toUpperCase()}", has_ack=${payload.data?.ack !== undefined}, has_status=${payload.data?.status !== undefined}, status="${payload.data?.status}"`);
    
    // HANDLE MESSAGE ACKNOWLEDGMENT (read receipts) - Evolution API v2 (case-insensitive)
    if (payload.event?.toUpperCase() === 'MESSAGES_UPDATE' && (payload.data?.ack !== undefined || payload.data?.status)) {
      console.log(`📬 [${requestId}] Processing message update acknowledgment: ack=${payload.data.ack}, status=${payload.data.status}`);
      
      const messageKey = payload.data.key;
      // Para messages.update, usar keyId (ID real da mensagem que foi salvo como external_id)
      // Para messages.upsert, usar key.id
      const evolutionMessageId = payload.data.keyId || messageKey?.id;
      
      console.log(`🔍 [${requestId}] Message ID detection: keyId=${payload.data.keyId}, messageId=${payload.data.messageId}, key.id=${messageKey?.id}, final=${evolutionMessageId}`);
      
      // Obter ack level do campo ack (numérico) ou mapear do campo status (string)
      let ackLevel = payload.data.ack;
      
      if (ackLevel === undefined && payload.data.status) {
        console.log(`🔄 [${requestId}] Mapping status "${payload.data.status}" to ack level`);
        
        switch (payload.data.status) {
          case 'PENDING':
            ackLevel = 0;
            break;
          case 'SERVER_ACK':
            ackLevel = 1;
            break;
          case 'DELIVERY_ACK':
            ackLevel = 2;
            break;
          case 'READ':
            ackLevel = 3;
            break;
          case 'PLAYED':
            ackLevel = 4;
            break;
          default:
            console.warn(`⚠️ [${requestId}] Unknown status: ${payload.data.status}`);
        }
      }
      
      // Get workspace_id from instance
      let workspaceId = null;
      if (instanceName) {
        const { data: connection } = await supabase
          .from('connections')
          .select('workspace_id')
          .eq('instance_name', instanceName)
          .single();
        
        if (connection) {
          workspaceId = connection.workspace_id;
        }
      }
      
      if (evolutionMessageId) {
        // Map Evolution ACK levels to our message status
        let newStatus: string | undefined;
        let timestampField: string | null = null;
        
        switch (ackLevel) {
          case 1:
            newStatus = 'sent';
            break;
          case 2:
            newStatus = 'delivered';
            timestampField = 'delivered_at';
            break;
          case 3:
            newStatus = 'read';
            timestampField = 'read_at';
            break;
          default:
            console.log(`⚠️ [${requestId}] Unknown ACK level: ${ackLevel}`);
            break;
        }
        
        if (newStatus) {
          // Update message status in database
          const updateData: any = { status: newStatus };
          if (timestampField) {
            updateData[timestampField] = new Date().toISOString();
          }
          
          const { data: updatedMessage, error: updateError } = await supabase
            .from('messages')
            .update(updateData)
            .eq('external_id', evolutionMessageId)
            .select('id, conversation_id, workspace_id')
            .maybeSingle();
            
          if (updateError) {
            console.error(`❌ [${requestId}] Error updating message status:`, updateError);
          } else if (updatedMessage) {
            console.log(`✅ [${requestId}] Message ${evolutionMessageId} status updated to: ${newStatus}`);
            console.log(`📊 [${requestId}] Updated message data:`, updatedMessage);
          } else {
            console.log(`⚠️ [${requestId}] Message not found for ACK update: ${evolutionMessageId}`);
          }
        }
      }
      
      // Get webhook URL for N8N
      let webhookUrl = null;
      let webhookSecret = null;
      
      if (workspaceId) {
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
      
      // Fallback to environment variables if no workspace webhook configured
      if (!webhookUrl) {
        webhookUrl = Deno.env.get('N8N_INBOUND_WEBHOOK_URL');
      }
      
      // Send LEAN payload to N8N for status update
      if (webhookUrl) {
        const updatePayload = {
          event: "MESSAGES_UPDATE",
          event_type: "update",
          workspace_id: workspaceId,
          request_id: requestId,
          external_id: evolutionMessageId,
          ack_level: ackLevel,
          status: ackLevel === 1 ? 'sent' : ackLevel === 2 ? 'delivered' : ackLevel === 3 ? 'read' : 'unknown',
          delivered_at: ackLevel === 2 ? new Date().toISOString() : null,
          read_at: ackLevel === 3 ? new Date().toISOString() : null,
          timestamp: new Date().toISOString()
        };
        
        console.log(`🚀 [${requestId}] Sending LEAN update payload to N8N:`, updatePayload);
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (webhookSecret) {
          headers['Authorization'] = `Bearer ${webhookSecret}`;
        }
        
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(updatePayload)
          });
          
          console.log(`✅ [${requestId}] N8N update webhook called successfully, status: ${response.status}`);
        } catch (error) {
          console.error(`❌ [${requestId}] Error calling N8N update webhook:`, error);
        }
      }
      
      // NÃO ENCERRAR O FLUXO - continuar para processar UPSERT também
      // Isso permite que o N8N receba AMBOS os eventos: update (ACK) e upsert (mensagem)
      console.log(`✅ [${requestId}] ACK processed, continuing to UPSERT processing to send both events to N8N...`);
    }
    
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
      const remoteJid = messageData.key?.remoteJid || '';
      
      // 🚫 FILTRAR MENSAGENS DE GRUPOS E BROADCASTS
      if (remoteJid.endsWith('@g.us')) {
        console.log(`🚫 [${requestId}] Ignoring GROUP message from: ${remoteJid}`);
        processedData = {
          skipped: true,
          reason: 'group_message',
          remoteJid: remoteJid
        };
      } else if (remoteJid.endsWith('@broadcast')) {
        console.log(`🚫 [${requestId}] Ignoring BROADCAST message from: ${remoteJid}`);
        processedData = {
          skipped: true,
          reason: 'broadcast_message',
          remoteJid: remoteJid
        };
      } else {
        // ✅ PROCESSAR APENAS MENSAGENS INDIVIDUAIS
        const phoneNumber = extractPhoneFromRemoteJid(remoteJid);
      const evolutionMessageId = messageData.key?.id;
      
      console.log(`📱 [${requestId}] RemoteJid processing: ${remoteJid} -> ${phoneNumber}`);
      
      // Check if payload includes profilePictureUrl directly in various possible locations
      const directProfileImageUrl = messageData?.message?.profilePictureUrl || 
                                   messageData?.profilePictureUrl || 
                                   payload?.profilePictureUrl ||
                                   payload?.data?.profilePictureUrl ||
                                   messageData?.message?.sender?.profilePicture ||
                                   messageData?.message?.contact?.profilePicture ||
                                   messageData?.profilePicture;
      
      if (directProfileImageUrl) {
        console.log(`🖼️ [${requestId}] Direct profile image URL found in payload: ${directProfileImageUrl}`);
      }
      
      // Log the entire payload structure for debugging
      console.log(`🔍 [${requestId}] Full payload structure:`, {
        event: payload.event,
        hasData: !!payload.data,
        hasMessage: !!messageData?.message,
        messageKeys: messageData?.message ? Object.keys(messageData.message) : [],
        dataKeys: messageData ? Object.keys(messageData) : [],
        payloadKeys: Object.keys(payload)
      });
      
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
        
        const sanitizedPhone = phoneNumber; // Already sanitized by extractPhoneFromRemoteJid
        
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

          // 🖼️ Process profile image (either direct from payload or fetch from API)  
          console.log(`🖼️ [${requestId}] Processing profile image for ${sanitizedPhone}`);
          
          try {
            let profileImageUrlToProcess = directProfileImageUrl;
            
            if (profileImageUrlToProcess) {
              console.log(`✅ [${requestId}] Using direct profile image URL from payload: ${profileImageUrlToProcess}`);
            } else {
              console.log(`🔍 [${requestId}] No direct profile URL, checking if we need to fetch from Evolution API`);
              
              // Check if contact already has a recent profile image
              const { data: contactData } = await supabase
                .from('contacts')
                .select('profile_image_updated_at, profile_fetch_last_attempt')
                .eq('id', contactId)
                .single();

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
                console.log(`🔄 [${requestId}] Fetching profile image from Evolution API for ${sanitizedPhone}`);
                
                // Update last attempt timestamp
                await supabase
                  .from('contacts')
                  .update({ profile_fetch_last_attempt: new Date().toISOString() })
                  .eq('id', contactId);
                
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
                  .eq('instance_name', instanceName)
                  .eq('workspace_id', workspaceId)
                  .single();

                if (connectionData?.connection_secrets?.[0]) {
                  const { token, evolution_url } = connectionData.connection_secrets[0];
                  
                  // Fetch profile image from Evolution API
                  console.log(`🔗 [${requestId}] Fetching profile from: ${evolution_url}/chat/findProfile/${instanceName}`);
                  
                  const profileResponse = await fetch(`${evolution_url}/chat/findProfile/${instanceName}`, {
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
                    console.log(`✅ [${requestId}] Profile data received from API:`, JSON.stringify(profileData, null, 2));
                    
                    profileImageUrlToProcess = profileData?.profilePictureUrl || profileData?.picture;
                  } else {
                    console.error(`❌ [${requestId}] Failed to fetch profile from Evolution API:`, profileResponse.status, await profileResponse.text());
                  }
                } else {
                  console.log(`⚠️ [${requestId}] No connection secrets found for instance ${instanceName}`);
                }
              }
            }
            
            // Process the profile image if we have a URL
            if (profileImageUrlToProcess && contactId && workspaceId) {
              console.log(`🖼️ [${requestId}] Processing profile image URL: ${profileImageUrlToProcess}`);
              
              // Call the new process-profile-image function
              const { error: profileError } = await supabase.functions.invoke('process-profile-image', {
                body: {
                  phone: sanitizedPhone,
                  profileImageUrl: profileImageUrlToProcess,
                  contactId: contactId,
                  workspaceId: workspaceId,
                  instanceName: instanceName
                }
              });

              if (profileError) {
                console.error(`❌ [${requestId}] Failed to process profile image:`, profileError);
              } else {
                console.log(`✅ [${requestId}] Profile image processing requested for ${sanitizedPhone}`);
              }
            } else {
              console.log(`ℹ️ [${requestId}] No profile image URL to process for ${sanitizedPhone}`);
            }
          } catch (error) {
            console.error(`❌ [${requestId}] Error with profile image processing:`, error);
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
              message_type: messageData.message?.audioMessage ? 'audio' :
                           messageData.message?.imageMessage ? 'image' : 
                           messageData.message?.videoMessage ? 'video' :
                           messageData.message?.documentMessage ? 'document' : 'text',
              sender_type: 'contact',
              status: 'received',
              origem_resposta: 'automatica',
              external_id: evolutionMessageId,
              file_url: messageData.message?.audioMessage?.url || 
                       messageData.message?.imageMessage?.url ||
                       messageData.message?.videoMessage?.url ||
                       messageData.message?.documentMessage?.url || null,
              mime_type: messageData.message?.audioMessage?.mimetype ||
                        messageData.message?.imageMessage?.mimetype ||
                        messageData.message?.videoMessage?.mimetype ||
                        messageData.message?.documentMessage?.mimetype || null,
              metadata: {
                source: 'evolution-webhook-v2',
                evolution_data: messageData,
                request_id: requestId,
                message_flow: 'inbound_original',
                duration_seconds: messageData.message?.audioMessage?.seconds || 
                                 messageData.message?.videoMessage?.seconds,
                waveform: messageData.message?.audioMessage?.waveform,
                is_ptt: messageData.message?.audioMessage?.ptt,
                file_size: messageData.message?.audioMessage?.fileLength ||
                          messageData.message?.imageMessage?.fileLength ||
                          messageData.message?.videoMessage?.fileLength ||
                          messageData.message?.documentMessage?.fileLength
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

          // Check if we need to auto-create a CRM card
          try {
            const { data: connectionData } = await supabase
              .from('connections')
              .select('auto_create_crm_card, default_pipeline_id')
              .eq('instance_name', instanceName)
              .eq('workspace_id', workspaceId)
              .maybeSingle();

            if (connectionData?.auto_create_crm_card && connectionData?.default_pipeline_id) {
              console.log(`🎯 [${requestId}] Auto-creating CRM card for conversation ${conversationId}`);
              
              // Check if card already exists
              const { data: existingCard } = await supabase
                .from('pipeline_cards')
                .select('id')
                .eq('conversation_id', conversationId)
                .maybeSingle();

              if (!existingCard) {
                await supabase.functions.invoke('auto-create-pipeline-card', {
                  body: {
                    conversationId,
                    contactId,
                    workspaceId,
                    pipelineId: connectionData.default_pipeline_id
                  }
                });
                console.log(`✅ [${requestId}] CRM card auto-creation triggered`);
              }
            }
          } catch (cardError) {
            console.error(`⚠️ [${requestId}] Error auto-creating CRM card:`, cardError);
            // Don't fail the webhook for card creation errors
          }

          processedData = {
            message_id: messageId,
            workspace_id: workspaceId,
            conversation_id: conversationId,
            contact_id: contactId,
            connection_id: resolvedConnectionId,
            instance: instanceName,
            phone_number: sanitizedPhone,
            external_id: payload.data?.key?.id,
            direction: payload.data?.key?.fromMe === false ? 'inbound' : 'outbound'
          };

          console.log(`✅ [${requestId}] Inbound message processed locally:`, processedData);
        }
      }
      } // ✅ FIM DO BLOCO: PROCESSAR APENAS MENSAGENS INDIVIDUAIS
    } else if (workspaceId && payload.data?.key?.fromMe === true) {
      console.log(`📤 [${requestId}] Outbound message detected, skipping local processing (will be handled by N8N response)`);
    }

    // Forward to N8N with processed data
    if (webhookUrl) {
      console.log(`🚀 [${requestId}] Forwarding to N8N: ${webhookUrl}`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (webhookSecret) {
        headers['Authorization'] = `Bearer ${webhookSecret}`;
      }

      try {
        // Debug log the payload structure
        console.log(`🔍 [${requestId}] Debug payload structure:`, {
          event: payload.event,
          fromMe: payload.data?.key?.fromMe,
          messageType: payload.data?.messageType,
          conversation: payload.data?.message?.conversation,
          hasMessage: !!payload.data?.message,
          messageKeys: payload.data?.message ? Object.keys(payload.data.message) : []
        });

        // Prepare N8N payload with ORIGINAL Evolution data structure + context
        const n8nPayload = {
          // Original Evolution API payload (preserving ALL data from Evolution)
          ...payload,
          
          // Additional context fields for convenience
          workspace_id: workspaceId,
          processed_data: processedData,
          timestamp: new Date().toISOString(),
          request_id: requestId,
          
          // Event type identification for N8N processing (based on original event)
          event_type: (() => {
            const eventLower = payload.event?.toLowerCase() || '';
            const isUpdate = eventLower.endsWith('update');
            console.log(`🔍 [${requestId}] Event type determination: event="${payload.event}", lower="${eventLower}", endsWithUpdate=${isUpdate}, result="${isUpdate ? 'update' : 'upsert'}"`);
            return isUpdate ? 'update' : 'upsert';
          })(),
          processed_locally: !!processedData,
          
          // Computed fields for convenience (but original data is preserved above)
          message_direction: payload.data?.key?.fromMe === true ? 'outbound' : 'inbound',
          phone_number: payload.data?.key?.remoteJid ? extractPhoneFromRemoteJid(payload.data.key.remoteJid) : null,
          
          // Debug info
          debug_info: {
            original_payload_keys: Object.keys(payload),
            data_keys: payload.data ? Object.keys(payload.data) : [],
            message_keys: payload.data?.message ? Object.keys(payload.data.message) : [],
            fromMe_value: payload.data?.key?.fromMe,
            calculated_direction: payload.data?.key?.fromMe === true ? 'outbound' : 'inbound',
            is_message_update: false // MESSAGES_UPDATE já retorna antes, então aqui sempre é false
          }
        };

        console.log(`🚀 [${requestId}] Sending to N8N:`, {
          url: webhookUrl,
          original_event: payload.event,
          event_type: n8nPayload.event_type,
          processed_locally: n8nPayload.processed_locally,
          has_processed_data: !!n8nPayload.processed_data
        });

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(n8nPayload)
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

  } catch (error) {
    console.error(`❌ [${requestId}] Error processing Evolution webhook:`, error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: (error as Error).message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
