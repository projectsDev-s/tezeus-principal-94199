import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para normalizar status do Z-API para o formato padrão
function normalizeZapiStatus(zapiStatus: string): string {
  const statusMap: Record<string, string> = {
    'SENT': 'sent',
    'DELIVERED': 'delivered', 
    'READ': 'read',
    'FAILED': 'failed',
    'PENDING': 'sending'
  };
  
  return statusMap[zapiStatus] || zapiStatus.toLowerCase();
}

// Função para extrair informações de mídia do payload Z-API
function extractMediaInfo(data: any): {
  downloadUrl?: string;
  mimeType?: string;
  fileName?: string;
  mediaType?: string;
} | null {
  if (data.image) {
    return {
      downloadUrl: data.image.downloadUrl || data.image.imageUrl,
      mimeType: data.image.mimeType || 'image/jpeg',
      fileName: data.image.fileName || `image-${Date.now()}.jpg`,
      mediaType: 'image'
    };
  }
  if (data.video) {
    return {
      downloadUrl: data.video.downloadUrl || data.video.videoUrl,
      mimeType: data.video.mimeType || 'video/mp4',
      fileName: data.video.fileName || `video-${Date.now()}.mp4`,
      mediaType: 'video'
    };
  }
  if (data.audio) {
    return {
      downloadUrl: data.audio.downloadUrl || data.audio.audioUrl,
      mimeType: data.audio.mimeType || 'audio/ogg',
      fileName: data.audio.fileName || `audio-${Date.now()}.ogg`,
      mediaType: 'audio'
    };
  }
  if (data.document) {
    return {
      downloadUrl: data.document.downloadUrl || data.document.documentUrl,
      mimeType: data.document.mimeType || 'application/octet-stream',
      fileName: data.document.fileName || `document-${Date.now()}`,
      mediaType: 'document'
    };
  }
  return null;
}

// Função para baixar mídia com retry
async function downloadMedia(url: string, maxRetries = 3): Promise<ArrayBuffer> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000) // 30s timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.arrayBuffer();
    } catch (error) {
      console.error(`❌ Download attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error('Failed after retries');
}

serve(async (req) => {
  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`🔥 [${id}] Z-API WEBHOOK - Method: ${req.method}`);

  try {
    const data = await req.json();
    console.log(`📦 [${id}] Data:`, JSON.stringify(data, null, 2));
    
    // 🔥🔥🔥 LOG DE DEBUG: Detectar callbacks de status
    if (data.event === 'MessageStatusCallback' || data.status) {
      console.log(`🔥🔥🔥 [${id}] CALLBACK DE STATUS RECEBIDO:`, {
        event: data.event,
        status: data.status,
        messageId: data.messageId,
        instanceName: data.instanceName || data.instance,
        timestamp: new Date().toISOString()
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Z-API pode enviar instanceName OU instanceId
    const instanceName = data.instanceName || data.instance || data.instanceId;
    
    if (!instanceName) {
      console.error(`❌ [${id}] No instance identifier found in payload`);
      return new Response(
        JSON.stringify({ success: false, error: "No instance name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📍 [${id}] Looking for instance: ${instanceName}`);

    // Buscar conexão pelo instance_name OU instance_id (para Z-API)
    const { data: conn, error: connError } = await supabase
      .from("connections")
      .select("*, provider:whatsapp_providers!connections_provider_id_fkey(n8n_webhook_url, zapi_client_token)")
      .or(`instance_name.eq.${instanceName},metadata->>instanceId.eq.${instanceName}`)
      .maybeSingle();

    if (connError) {
      console.error(`❌ [${id}] Database error:`, connError);
    }

    if (!conn) {
      console.error(`❌ [${id}] Connection not found for instance: ${instanceName}`);
      return new Response(
        JSON.stringify({ success: false, error: "Connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ [${id}] Connection: ${conn.id}, Workspace: ${conn.workspace_id}, Instance Name: ${conn.instance_name}`);

    const n8nUrl = conn.provider?.n8n_webhook_url;
    
    if (n8nUrl) {
      console.log(`🚀 [${id}] Forwarding to: ${n8nUrl}`);
      
      // Extrair external_id do messageId do Z-API
      // Para MessageStatusCallback, o ID vem em data.ids[0]
      const externalId = data.messageId || data.id || (data.ids && data.ids[0]) || null;
      
      // Verificar se há mídia no payload
      const mediaInfo = extractMediaInfo(data);
      let base64: string | undefined;
      
      if (mediaInfo?.downloadUrl) {
        try {
          console.log(`📥 [${id}] Downloading media from: ${mediaInfo.downloadUrl}`);
          const mediaBuffer = await downloadMedia(mediaInfo.downloadUrl);
          
          // Converter para base64
          const uint8Array = new Uint8Array(mediaBuffer);
          const binaryString = Array.from(uint8Array)
            .map(byte => String.fromCharCode(byte))
            .join('');
          base64 = btoa(binaryString);
          
          console.log(`✅ [${id}] Media downloaded and converted to base64 (${mediaInfo.mediaType}, ${Math.round(base64.length / 1024)}KB)`);
        } catch (error) {
          console.error(`❌ [${id}] Failed to download media:`, error);
          // Continue sem base64 se falhar
        }
      }
      
      // Extrair instance_token do metadata
      const instanceToken = conn.metadata?.token || 
                           conn.metadata?.instanceToken || 
                           conn.metadata?.instance_token;
      
      // Extrair client_token do provider
      const clientToken = conn.provider?.zapi_client_token;
      
      // Normalizar status se presente no payload (para callbacks de status)
      let normalizedStatus = data.status;
      if (data.status && typeof data.status === 'string') {
        normalizedStatus = normalizeZapiStatus(data.status);
        console.log(`🔄 [${id}] Status normalizado: ${data.status} → ${normalizedStatus}`);
      }
      
      // ✅ ATUALIZAR STATUS DA MENSAGEM NO BANCO DE DADOS
      if (data.type === 'MessageStatusCallback' && data.ids && data.ids.length > 0) {
        const messageExternalId = data.ids[0]; // ID da mensagem no Z-API
        console.log(`🔥🔥🔥 [${id}] CALLBACK DE STATUS RECEBIDO:`, {
          type: data.type,
          messageExternalId,
          rawStatus: data.status,
          normalizedStatus,
          workspaceId: conn.workspace_id,
          timestamp: new Date().toISOString()
        });
        
        const updateData: any = {
          status: normalizedStatus,
          updated_at: new Date().toISOString()
        };
        
        // Adicionar timestamps específicos
        if (normalizedStatus === 'delivered') {
          updateData.delivered_at = new Date().toISOString();
        } else if (normalizedStatus === 'read') {
          updateData.read_at = new Date().toISOString();
        }
        
        console.log(`📝 [${id}] Executando UPDATE no banco:`, {
          messageExternalId,
          updateData,
          workspaceId: conn.workspace_id
        });
        
        const { data: updatedMessage, error: updateError } = await supabase
          .from('messages')
          .update(updateData)
          .eq('external_id', messageExternalId)
          .eq('workspace_id', conn.workspace_id)
          .select()
          .maybeSingle();
          
        if (updateError) {
          console.error(`❌ [${id}] Erro ao atualizar status da mensagem ${messageExternalId}:`, updateError);
        } else if (updatedMessage) {
          console.log(`✅✅✅ [${id}] STATUS ATUALIZADO NO BANCO COM SUCESSO:`, {
            messageId: updatedMessage.id,
            external_id: messageExternalId,
            oldStatus: 'unknown',
            newStatus: normalizedStatus,
            conversation_id: updatedMessage.conversation_id,
            updatedMessage
          });
        } else {
          console.warn(`⚠️⚠️⚠️ [${id}] MENSAGEM NÃO ENCONTRADA NO BANCO:`, {
            messageExternalId,
            workspaceId: conn.workspace_id,
            tentouBuscarCom: {
              external_id: messageExternalId,
              workspace_id: conn.workspace_id
            }
          });
        }
      }
      
      // Montar payload para n8n
      const n8nPayload: any = {
        event_type: data.event || data.type || 'UNKNOWN',
        provider: 'zapi',
        instance_name: conn.instance_name,
        instance_token: instanceToken, // ✅ Token da instância Z-API
        client_token: clientToken, // ✅ Client token da instância Z-API
        workspace_id: conn.workspace_id,
        connection_id: conn.id,
        external_id: externalId,
        status: normalizedStatus, // ✅ Status normalizado
        timestamp: new Date().toISOString(),
        webhook_data: {
          ...data,
          status: normalizedStatus // ✅ Sobrescrever status no webhook_data também
        }
      };
      
      // Adicionar dados de mídia se disponível
      if (mediaInfo) {
        n8nPayload.media = {
          base64,
          fileName: mediaInfo.fileName,
          mimeType: mediaInfo.mimeType,
          mediaUrl: mediaInfo.downloadUrl,
          mediaType: mediaInfo.mediaType
        };
      }
      
      fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(n8nPayload)
      })
        .then(r => console.log(`✅ [${id}] N8N: ${r.status}`))
        .catch(e => console.error(`❌ [${id}] N8N error:`, e));
    } else {
      console.warn(`⚠️ [${id}] No N8N webhook URL configured for this provider`);
    }

    return new Response(
      JSON.stringify({ success: true, id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`❌ [${id}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
