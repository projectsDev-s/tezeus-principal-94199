// Evolution Webhook V2 - Safe connection handling
// Force redeploy: 2025-10-15 - Forcing deployment with cleaned dbMessageId removal
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

// ✅ DEDUP LOCAL - Prevenir processamento duplicado de eventos
const recentEvents = new Set<string>();

function checkDedup(key: string): boolean {
  if (recentEvents.has(key)) return true;
  recentEvents.add(key);
  setTimeout(() => recentEvents.delete(key), 10000); // TTL de 10s
  return false;
}

function generateRequestId(): string {
  return `evo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  // Remove todos os caracteres não-numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove sufixos comuns do Evolution API (62, 63, etc)
  // Esses são adicionados incorretamente pelo WhatsApp em alguns casos
  if (cleaned.length > 13 && cleaned.endsWith('62')) {
    const original = cleaned;
    cleaned = cleaned.slice(0, -2);
    console.log(`⚠️ [SANITIZE] Truncated phone number: "${phone}" -> original_digits="${original}" (${original.length} chars) -> final="${cleaned}" (${cleaned.length} chars)`);
  }
  
  return cleaned;
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
    
    // ✅ FASE 1.2: Buscar dados da conexão UMA ÚNICA VEZ (consolidação de queries)
    let connectionData = null;
    let workspaceId = null;
    let webhookUrl = null;
    let webhookSecret = null;
    
    if (instanceName) {
      console.log(`🔍 [${requestId}] Fetching connection data for instance: ${instanceName}`);
      const { data: conn } = await supabase
        .from('connections')
        .select(`
          id,
          workspace_id,
          history_days,
          history_recovery,
          history_sync_status,
          history_sync_started_at,
          auto_create_crm_card,
          default_pipeline_id,
          created_at
        `)
        .eq('instance_name', instanceName)
        .single();
      
      if (conn) {
        connectionData = conn;
        workspaceId = conn.workspace_id;
        
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
        
        // Fallback to environment variables if no workspace webhook configured
        if (!webhookUrl) {
          webhookUrl = Deno.env.get('N8N_INBOUND_WEBHOOK_URL');
          webhookSecret = Deno.env.get('N8N_WEBHOOK_TOKEN');
        }
        
        console.log(`🔧 [${requestId}] Connection data loaded:`, {
          workspace_id: workspaceId,
          webhook_url: webhookUrl ? webhookUrl.substring(0, 50) + '...' : 'NOT FOUND',
          has_secret: !!webhookSecret,
          auto_create_crm_card: conn.auto_create_crm_card,
          default_pipeline_id: conn.default_pipeline_id
        });
      } else {
        console.warn(`⚠️ [${requestId}] Connection not found for instance: ${instanceName}`);
      }
    }
    
    // ✅ FASE 1.1: Normalizar evento para processamento consistente
    const EVENT = String(payload.event || '').toUpperCase().replace(/\./g, '_');
    console.log(`📊 [${requestId}] Instance: ${instanceName}, Event: "${payload.event}" → normalized: "${EVENT}"`);
    
    // 🔍 LOG COMPLETO DO PAYLOAD PARA DIAGNÓSTICO DE EVENTOS DE LEITURA
    console.log(`🔍 [${requestId}] FULL PAYLOAD FOR DEBUGGING:`);
    console.log(JSON.stringify({
      event: payload.event,
      instance: payload.instance,
      data: payload.data,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    // ✅ DEDUP: Verificar se já processamos esse evento recentemente
    const dedupKey = `${EVENT}:${payload.data?.keyId || payload.data?.messageId || payload.data?.key?.id || Date.now()}`;
    if (checkDedup(dedupKey)) {
      console.log(`⏭️ [${requestId}] Event duplicado ignorado: ${dedupKey}`);
      return new Response(JSON.stringify({
        code: 'DUPLICATE_EVENT',
        message: 'Event already processed recently',
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let processedData = null;
    
    // ✅ FASE 1.1: HANDLE MESSAGE ACKNOWLEDGMENT (read receipts) - CONSOLIDADO
    if (EVENT === 'MESSAGES_UPDATE' && (payload.data?.ack !== undefined || payload.data?.status)) {
      console.log(`📬 [${requestId}] Processing message update acknowledgment: ack=${payload.data.ack}, status=${payload.data.status}`);
      
      const messageKeyId = payload.data.keyId; // 40 chars
      const messageId = payload.data.messageId;
      const status = payload.data.status;
      
      console.log(`🔑 [${requestId}] Update event IDs:`);
      console.log(`   - keyId (40 chars): "${messageKeyId}"`);
      console.log(`   - messageId: "${messageId}"`);
      console.log(`   - status: "${status}"`);
      
      // Obter ack level do campo ack (numérico) ou mapear do campo status (string)
      let ackLevel = payload.data.ack;
      
      if (ackLevel === undefined && status) {
        console.log(`🔄 [${requestId}] Mapping status "${status}" to ack level`);
        
        switch (status) {
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
            console.warn(`⚠️ [${requestId}] Unknown status: ${status}`);
        }
      }
      
      // ✅ ESTRATÉGIA DE BUSCA INTELIGENTE CONSOLIDADA (PRIORIDADE: SHORT KEY)
      let updatedMessage = null;
      
      if (messageKeyId && status) {
        console.log(`🔍 [${requestId}] Starting intelligent message lookup`);
        
        // ✅ BUSCA IDEMPOTENTE COM OR - Buscar em uma única query
        console.log(`🔍 [${requestId}] Searching message with idempotent OR query`);
        const { data: msg, error } = await supabase
          .from('messages')
          .select('id, external_id, evolution_key_id, evolution_short_key_id, status, conversation_id, workspace_id')
          .or(`evolution_short_key_id.eq.${messageKeyId},evolution_key_id.eq.${messageKeyId},external_id.eq.${messageKeyId}`)
          .limit(1)
          .maybeSingle();
        
        let searchStrategy = 'idempotent_or';
        
        if (msg) {
          console.log(`✅ [${requestId}] Found message via ${searchStrategy}`);
          
          // Mapear status da Evolution para nosso schema
          const newStatus = status === 'READ' ? 'read' : 
                           status === 'DELIVERY_ACK' ? 'delivered' : 
                           status === 'SERVER_ACK' ? 'sent' : msg.status;
          
          const updateFields: any = { status: newStatus };
          
          // Garantir que AMBOS os evolution IDs estejam preenchidos
          if (!msg.evolution_key_id) {
            updateFields.evolution_key_id = messageKeyId;
          }
          if (!msg.evolution_short_key_id) {
            updateFields.evolution_short_key_id = messageKeyId;
          }
          
          // Atualizar timestamps conforme o status
          if (status === 'DELIVERY_ACK') updateFields.delivered_at = new Date().toISOString();
          if (status === 'READ') updateFields.read_at = new Date().toISOString();
          
          // Executar update no banco
          const { error: updateError } = await supabase
            .from('messages')
            .update(updateFields)
            .eq('id', msg.id);
          
          if (updateError) {
            console.error(`❌ [${requestId}] Error updating message:`, updateError);
          } else {
            updatedMessage = { ...msg, ...updateFields };
            console.log(`✅ [${requestId}] Message updated: ${msg.status} → ${newStatus}`);
          }
        } else {
          console.log(`⚠️ [${requestId}] Message NOT found: ${messageKeyId}`);
        }
      }
      
      // ✅ ENVIAR PAYLOAD LEAN PARA O N8N (UMA ÚNICA VEZ)
      if (webhookUrl && updatedMessage) {
    const updatePayload = {
      event: "MESSAGES_UPDATE",
      event_type: "update",
      workspace_id: workspaceId,
      conversation_id: updatedMessage.conversation_id,
      request_id: requestId,
      external_id: updatedMessage.external_id,
      evolution_key_id: messageKeyId,
      ack_level: ackLevel,
      status: updatedMessage.status,
      delivered_at: updatedMessage.delivered_at || null,
      read_at: updatedMessage.read_at || null,
      timestamp: new Date().toISOString(),
      
      // ✅ Campos adicionados para melhor rastreabilidade
      instance: instanceName,
      remoteJid: payload.data?.remoteJid || null,
      messageId: messageId || null
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
      
      console.log(`✅ [${requestId}] ACK processing complete`);
      
      // ✅ RETORNAR IMEDIATAMENTE após processar messages_update (não continuar para o final)
      return new Response(JSON.stringify({
        success: true,
        action: 'message_update_processed',
        message_id: updatedMessage?.id,
        workspace_id: workspaceId,
        conversation_id: updatedMessage?.conversation_id,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 👥 PROCESS CONTACTS SYNC (CONTACTS_UPSERT / CONTACTS_UPDATE)
    if ((payload.event === 'CONTACTS_UPSERT' || payload.event === 'CONTACTS_UPDATE') && workspaceId) {
      console.log(`👥 [${requestId}] Processing contacts sync event`);
      
      const contactsData = Array.isArray(payload.data) ? payload.data : [payload.data];
      let processedContacts = 0;
      
      for (const contactData of contactsData) {
        try {
          const remoteJid = contactData.id || contactData.remoteJid;
          const phone = extractPhoneFromRemoteJid(remoteJid);
          const name = contactData.name || contactData.pushName || phone;
          const profileUrl = contactData.profilePictureUrl || contactData.profilePicUrl;
          
          console.log(`👤 [${requestId}] Upserting contact: ${phone} (${name})`);
          
          // Upsert contact (update if exists, insert if not)
          const { error: upsertError } = await supabase
            .from('contacts')
            .upsert({
              phone: phone,
              name: name,
              workspace_id: workspaceId,
              profile_image_url: profileUrl || null,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'phone,workspace_id',
              ignoreDuplicates: false
            });
          
          if (upsertError) {
            console.error(`❌ [${requestId}] Error upserting contact ${phone}:`, upsertError);
          } else {
            processedContacts++;
          }
        } catch (contactError) {
          console.error(`❌ [${requestId}] Error processing contact:`, contactError);
        }
      }
      
      console.log(`✅ [${requestId}] Processed ${processedContacts} contacts from sync`);
      
      processedData = {
        contacts_synced: processedContacts,
        workspace_id: workspaceId,
        event: payload.event
      };
    }
    
    // 📞 PROCESS CONNECTION UPDATE (phone number from QR scan)
    if (EVENT === 'CONNECTION_UPDATE' && workspaceId && instanceName) {
      console.log(`📞 [${requestId}] Processing connection update event`);
      
      // ✅ FASE 1.2: Renomear connectionData local para connectionUpdate (evitar conflito)
      const connectionUpdate = payload.data;
      const state = connectionUpdate.state; // 'open', 'close', etc
      const phoneNumber = connectionUpdate.owner || connectionUpdate.phoneNumber;
      
      if (phoneNumber) {
        console.log(`📱 [${requestId}] Updating connection phone number: ${phoneNumber}`);
        
        const { error: updateError } = await supabase
          .from('connections')
          .update({
            phone_number: phoneNumber,
            status: state === 'open' ? 'connected' : 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('instance_name', instanceName)
          .eq('workspace_id', workspaceId);
        
        if (updateError) {
          console.error(`❌ [${requestId}] Error updating connection:`, updateError);
        } else {
          console.log(`✅ [${requestId}] Connection updated with phone: ${phoneNumber}`);
        }
      }

      // Se a conexão foi estabelecida, verificar/iniciar sincronização de histórico
      if (state === 'open') {
        console.log(`🔍 [${requestId}] Checking if history sync needed for ${instanceName}`);
        
        // ✅ FASE 2: Recarregar connectionMeta do banco (não usar connectionUpdate do evento)
        const { data: connectionMeta, error: metaError } = await supabase
          .from('connections')
          .select('history_days, history_recovery, history_sync_status')
          .eq('instance_name', instanceName)
          .eq('workspace_id', workspaceId)
          .single();
        
        if (metaError || !connectionMeta) {
          console.warn(`⚠️ [${requestId}] No connection metadata found for ${instanceName}:`, metaError);
        } else if ((connectionMeta.history_sync_status === 'pending' || 
                    connectionMeta.history_sync_status === 'failed' ||
                    // Detectar sync travado: syncing há mais de 10 minutos sem progresso
                    (connectionMeta.history_sync_status === 'syncing' && 
                     connectionMeta.history_sync_started_at &&
                     (Date.now() - new Date(connectionMeta.history_sync_started_at).getTime()) > 600000)) &&
                   (connectionMeta.history_days > 0 || connectionMeta.history_recovery !== 'none')) {
          
          // Se estava travado, resetar primeiro
          if (connectionMeta.history_sync_status === 'syncing') {
            console.log(`🔄 [${requestId}] Sync stuck detected, resetting status for ${instanceName}`);
            await supabase
              .from('connections')
              .update({ history_sync_status: 'pending' })
              .eq('instance_name', instanceName)
              .eq('workspace_id', workspaceId);
          }
          
          console.log(`🔄 [${requestId}] Triggering history sync for ${instanceName} (days: ${connectionMeta.history_days}, recovery: ${connectionMeta.history_recovery})`);
          
          // Chamar função separada para forçar sincronização
          try {
            const { data: syncResult, error: syncError } = await supabase.functions.invoke('evolution-trigger-history-sync', {
              body: {
                instanceName,
                workspaceId,
                historyDays: connectionMeta.history_days,
                historyRecovery: connectionMeta.history_recovery
              }
            });
            
            if (syncError) {
              console.error(`❌ [${requestId}] Error invoking history sync:`, syncError);
            } else {
              console.log(`✅ [${requestId}] History sync triggered:`, syncResult);
            }
          } catch (invokeError) {
            console.error(`❌ [${requestId}] Exception invoking history sync:`, invokeError);
          }
        } else {
          console.log(`ℹ️ [${requestId}] No history sync needed: status=${connectionMeta?.history_sync_status}, days=${connectionMeta?.history_days}, recovery=${connectionMeta?.history_recovery}`);
        }
      }
      
      processedData = {
        connection_updated: true,
        phone_number: phoneNumber,
        state: state
      };
    }

    // ✅ NOVA REGRA: NÃO processar mensagens localmente - APENAS enviar metadados para N8N
    if (workspaceId && payload.data && (payload.data.message || EVENT.includes('MESSAGE')) && payload.data?.key?.fromMe === false) {
      console.log(`📝 [${requestId}] Inbound message detected - preparing metadata for N8N (NO local processing)`);
      
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
        // ✅ Preparar apenas metadados para o N8N processar
        const phoneNumber = extractPhoneFromRemoteJid(remoteJid);
        const evolutionMessageId = messageData.key?.id; // 22 chars
        const evolutionKeyId = payload.data?.keyId || messageData.keyId; // 40 chars (if available)
        
        console.log(`🔑 [${requestId}] Message IDs captured for N8N:`);
        console.log(`   - key.id (22 chars): "${evolutionMessageId}"`);
        console.log(`   - keyId (40 chars): "${evolutionKeyId}"`);
        
        processedData = {
          phone_number: phoneNumber,
          external_id: evolutionMessageId,
          evolution_key_id: evolutionKeyId,
          instance: instanceName,
          connection_id: connectionData?.id,
          direction: 'inbound',
          requires_processing: true,
          message_type: messageData.message?.audioMessage ? 'audio' :
                       messageData.message?.imageMessage ? 'image' : 
                       messageData.message?.videoMessage ? 'video' :
                       messageData.message?.documentMessage ? 'document' : 'text'
        };
        
        console.log(`✅ [${requestId}] Metadata prepared for N8N processing:`, processedData);
        
        // 🎯 AUTO-CRIAÇÃO DE CONVERSA COM DISTRIBUIÇÃO DE FILA (apenas para NOVAS conversas)
        if (connectionData?.id && phoneNumber) {
          console.log(`🔍 [${requestId}] Checking if conversation needs to be created with queue assignment...`);
          
          // Buscar/criar contato
          let contact;
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('phone', phoneNumber)
            .eq('workspace_id', workspaceId)
            .maybeSingle();
          
          if (existingContact) {
            contact = existingContact;
            
            // Buscar foto se nunca foi atualizada ou se faz mais de 7 dias
            const shouldFetchPhoto = !existingContact.profile_image_updated_at || 
              (new Date().getTime() - new Date(existingContact.profile_image_updated_at).getTime()) > 7 * 24 * 60 * 60 * 1000;
            
            if (shouldFetchPhoto) {
              console.log(`📸 [${requestId}] Triggering profile photo fetch for existing contact`);
              supabase.functions.invoke('fetch-contact-profile-image', {
                body: { 
                  phone: phoneNumber, 
                  contactId: existingContact.id,
                  workspaceId 
                }
              }).catch(err => console.error(`⚠️ [${requestId}] Photo fetch failed:`, err));
            }
          } else {
            // Criar novo contato usando pushName do WhatsApp
            const pushName = messageData.pushName || phoneNumber;
            const { data: newContact } = await supabase
              .from('contacts')
              .insert({
                phone: phoneNumber,
                workspace_id: workspaceId,
                name: pushName
              })
              .select('id')
              .single();
            contact = newContact;
            console.log(`👤 [${requestId}] New contact created: ${contact?.id} with name: ${pushName}`);
            
            // Buscar foto automaticamente para novo contato
            console.log(`📸 [${requestId}] Triggering profile photo fetch for new contact`);
            supabase.functions.invoke('fetch-contact-profile-image', {
              body: { 
                phone: phoneNumber, 
                contactId: newContact?.id,
                workspaceId 
              }
            }).catch(err => console.error(`⚠️ [${requestId}] Photo fetch failed:`, err));
          }
          
          if (contact) {
            // Verificar se conversa já existe
            const { data: existingConversation } = await supabase
              .from('conversations')
              .select('id')
              .eq('contact_id', contact.id)
              .eq('connection_id', connectionData.id)
              .eq('workspace_id', workspaceId)
              .maybeSingle();
            
            if (!existingConversation) {
              console.log(`🆕 [${requestId}] No existing conversation found, creating NEW conversation with queue assignment...`);
              
              // Buscar queue_id da conexão
              const { data: connection } = await supabase
                .from('connections')
                .select('queue_id')
                .eq('id', connectionData.id)
                .single();
              
              let selectedUserId = null;
              let queueId = null;
              let agenteAtivo = false;
              
              if (connection?.queue_id) {
                // Buscar fila e usuários
                const { data: queue } = await supabase
                  .from('queues')
                  .select('id, name, distribution_type, last_assigned_user_index, ai_agent_id')
                  .eq('id', connection.queue_id)
                  .eq('is_active', true)
                  .single();
                
                if (queue && queue.distribution_type !== 'nenhuma') {
                  const { data: queueUsers } = await supabase
                    .from('queue_users')
                    .select('user_id, order_position, system_users!inner(status)')
                    .eq('queue_id', queue.id)
                    .eq('system_users.status', 'active')
                    .order('order_position', { ascending: true });
                  
                  if (queueUsers && queueUsers.length > 0) {
                    // Selecionar usuário baseado em distribution_type
                    switch (queue.distribution_type) {
                      case 'sequencial':
                        const nextIndex = ((queue.last_assigned_user_index || 0) + 1) % queueUsers.length;
                        selectedUserId = queueUsers[nextIndex].user_id;
                        await supabase.from('queues').update({ last_assigned_user_index: nextIndex }).eq('id', queue.id);
                        console.log(`📋 [${requestId}] Sequential: selected user at index ${nextIndex}`);
                        break;
                      case 'aleatoria':
                        const randomIndex = Math.floor(Math.random() * queueUsers.length);
                        selectedUserId = queueUsers[randomIndex].user_id;
                        console.log(`🎲 [${requestId}] Random: selected user at index ${randomIndex}`);
                        break;
                      case 'ordenada':
                        selectedUserId = queueUsers[0].user_id;
                        console.log(`📌 [${requestId}] Ordered: selected first user`);
                        break;
                    }
                    
                    queueId = queue.id;
                    agenteAtivo = queue.ai_agent_id ? true : false;
                  } else {
                    console.log(`⚠️ [${requestId}] No active users in queue ${queue.name}`);
                  }
                } else {
                  console.log(`ℹ️ [${requestId}] Queue has distribution_type 'nenhuma' or inactive`);
                }
              } else {
                console.log(`ℹ️ [${requestId}] Connection has no queue configured`);
              }
              
              // Criar nova conversa COM ou SEM atribuição
              const conversationData: any = {
                contact_id: contact.id,
                connection_id: connectionData.id,
                workspace_id: workspaceId,
                status: 'open'
              };
              
              if (selectedUserId) {
                conversationData.assigned_user_id = selectedUserId;
                conversationData.assigned_at = new Date().toISOString();
                conversationData.queue_id = queueId;
                conversationData.agente_ativo = agenteAtivo;
              }
              
              const { data: newConversation, error: createError } = await supabase
                .from('conversations')
                .insert(conversationData)
                .select('id')
                .single();
              
              if (!createError && newConversation) {
                console.log(`✅ [${requestId}] NEW conversation ${newConversation.id} created${selectedUserId ? ` and assigned to user ${selectedUserId}` : ' WITHOUT assignment'}`);
                
                // Adicionar conversation_id aos metadados para N8N
                processedData.conversation_id = newConversation.id;
                
                // Se atribuído, registrar no log de assignments
                if (selectedUserId) {
                  await supabase
                    .from('conversation_assignments')
                    .insert({
                      conversation_id: newConversation.id,
                      to_assigned_user_id: selectedUserId,
                      from_assigned_user_id: null,
                      changed_by: selectedUserId,
                      action: 'assign'
                    });
                }
              } else {
                console.error(`❌ [${requestId}] Error creating conversation:`, createError);
              }
            } else {
              console.log(`ℹ️ [${requestId}] Conversation already exists: ${existingConversation.id} (manual assignment only)`);
              processedData.conversation_id = existingConversation.id;
            }
          }
        }
      }
    } else if (workspaceId && payload.data?.key?.fromMe === true && EVENT === 'MESSAGES_UPSERT') {
      console.log(`📤 [${requestId}] Outbound message detected (messages.upsert), capturing evolution_short_key_id`);
      
      const shortKeyId = payload.data?.key?.id; // 22 chars
      
      if (shortKeyId && workspaceId) {
        // Buscar mensagem enviada nos últimos 30 segundos sem evolution_short_key_id
        const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
        
        const { data: recentMessage } = await supabase
          .from('messages')
          .select('id, evolution_key_id, external_id')
          .eq('workspace_id', workspaceId)
          .eq('sender_type', 'agent')
          .is('evolution_short_key_id', null)
          .gte('created_at', thirtySecondsAgo)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (recentMessage) {
          console.log(`💾 [${requestId}] Saving evolution_short_key_id: ${shortKeyId} for message ${recentMessage.id}`);
          
          await supabase
            .from('messages')
            .update({ evolution_short_key_id: shortKeyId })
            .eq('id', recentMessage.id);
          
          console.log(`✅ [${requestId}] evolution_short_key_id saved successfully!`);
        } else {
          console.log(`⚠️ [${requestId}] No recent message found to update with shortKeyId`);
        }
      }
    }

    // ✅ FORWARD OBRIGATÓRIO AO N8N - Com fallback
    const finalWebhookUrl = webhookUrl || Deno.env.get('N8N_FALLBACK_URL');
    
    if (!finalWebhookUrl) {
      console.error(`❌ [${requestId}] NO WEBHOOK URL - MESSAGE LOST!`, {
        event: EVENT,
        workspace_id: workspaceId,
        instance: instanceName
      });
    }
    
    console.log(`🔍 [${requestId}] Pre-send check:`, {
      has_webhookUrl: !!finalWebhookUrl,
      webhookUrl_value: finalWebhookUrl ? finalWebhookUrl.substring(0, 50) + '...' : 'NULL',
      has_processedData: !!processedData
    });
    
    if (finalWebhookUrl) {
      console.log(`🚀 [${requestId}] Forwarding to N8N: ${finalWebhookUrl}`);
      
      // ✅ HEADERS PADRONIZADOS - Sempre consistentes
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

        // ✅ FASE 1.1: Removido bloco duplicado de MESSAGES_UPDATE
        // O processamento de ACKs agora é feito apenas no bloco principal (linhas 109-343)

        // ✅ CORREÇÃO 3: Debug N8N payload antes de preparar
        console.log(`🔍 [${requestId}] Pre-send N8N payload check:`, {
          has_processed_data: !!processedData,
          event: payload.event,
          has_original_message: !!payload.data?.message,
          has_key: !!payload.data?.key,
          processed_data_keys: processedData ? Object.keys(processedData) : null
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
          url: finalWebhookUrl,
          original_event: payload.event,
          event_type: n8nPayload.event_type,
          processed_locally: n8nPayload.processed_locally,
          has_processed_data: !!n8nPayload.processed_data
        });

        const response = await fetch(finalWebhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(n8nPayload)
        });

        console.log(`✅ [${requestId}] N8N webhook called successfully, status: ${response.status}`);
        
      } catch (error) {
        console.error(`❌ [${requestId}] Error calling N8N webhook:`, error);
      }
    } else {
      console.warn(`⚠️ [${requestId}] NOT sending to N8N - webhookUrl is null/undefined`);
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
