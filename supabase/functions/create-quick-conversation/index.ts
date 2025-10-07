import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { phoneNumber } = await req.json()

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Número de telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get workspace_id from headers
    const workspaceId = req.headers.get('x-workspace-id')
    
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Workspace ID não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Normalize phone number to digits only (consistent with webhooks)
    const normalizedPhone = phoneNumber.replace(/\D/g, '')

    console.log(`Creating quick conversation for phone: ${normalizedPhone}`)
    
    // PROTEÇÃO: Bloquear uso de números da instância como contato
    const { data: connections } = await supabase
      .from('connections')
      .select('phone_number, instance_name')
      .eq('workspace_id', workspaceId)
    
    const isInstanceNumber = connections?.some(conn => {
      const connPhone = conn.phone_number?.replace(/\D/g, '')
      return connPhone && normalizedPhone === connPhone
    })
    
    if (isInstanceNumber) {
      console.error(`❌ BLOQUEADO: Tentativa de criar conversa com número da instância: ${normalizedPhone}`)
      return new Response(
        JSON.stringify({ 
          error: 'Este número pertence a uma instância WhatsApp e não pode ser usado como contato.',
          success: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if contact already exists
    let { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', normalizedPhone)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    let contactId = existingContact?.id

    // Create temporary contact if doesn't exist
    if (!contactId) {
      console.log(`🏗️ CRIANDO NOVO CONTATO (create-quick-conversation):`, {
        phone: normalizedPhone,
        name: `+${normalizedPhone}`,
        workspace_id: workspaceId,
        source: 'create-quick-conversation'
      })
      
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          name: normalizedPhone, // SEM PREFIXO - apenas o número
          phone: normalizedPhone,
          workspace_id: workspaceId,
          extra_info: { temporary: true }
        })
        .select('id')
        .single()

      if (contactError) {
        console.error('Error creating contact:', contactError)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar contato temporário' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      contactId = newContact.id
      console.log(`Created temporary contact with ID: ${contactId}`)

      // 🖼️ Try to fetch profile image for new contact
      try {
        console.log(`🖼️ Attempting to fetch profile image for new contact: ${normalizedPhone}`);
        
        const { error: profileError } = await supabase.functions.invoke('fetch-contact-profile-image', {
          body: {
            phone: normalizedPhone,
            contactId: contactId,
            workspaceId: workspaceId
          }
        });

        if (profileError) {
          console.error(`⚠️ Failed to fetch profile image (non-blocking):`, profileError);
        } else {
          console.log(`✅ Profile image fetch requested for ${normalizedPhone}`);
        }
      } catch (profileFetchError) {
        console.error(`⚠️ Error requesting profile image (non-blocking):`, profileFetchError);
      }
    } else {
      console.log(`Using existing contact with ID: ${contactId}`)
    }

    // Check if open conversation already exists
    let { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('status', 'open')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    let conversationId = existingConversation?.id

    // Create conversation if doesn't exist
    if (!conversationId) {
      console.log('📡 Creating new conversation for contact:', contactId);

      const conversationData: any = {
        contact_id: contactId,
        status: 'open',
        workspace_id: workspaceId,
        canal: 'whatsapp',
        agente_ativo: false
      }

      const { data: newConversation, error: conversationError } = await supabase
        .from('conversations')
        .insert(conversationData)
        .select('id')
        .single()

      if (conversationError) {
        console.error('Error creating conversation:', conversationError)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar conversa' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      conversationId = newConversation.id
      console.log(`Created new conversation with ID: ${conversationId}`)
    } else {
      console.log(`Using existing conversation with ID: ${conversationId}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversationId, 
        contactId,
        phoneNumber: normalizedPhone 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in create-quick-conversation:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})