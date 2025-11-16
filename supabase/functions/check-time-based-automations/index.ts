import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('⏰ [Time Automations] Starting check...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar todas as automações ativas com trigger de tempo
    const { data: automations, error: automationsError } = await supabase
      .from('crm_column_automations')
      .select(`
        id,
        column_id,
        workspace_id,
        name,
        triggers:crm_column_automation_triggers!inner(
          trigger_type,
          trigger_config
        ),
        actions:crm_column_automation_actions(
          action_type,
          action_config,
          action_order
        )
      `)
      .eq('is_active', true)
      .eq('triggers.trigger_type', 'tempo_na_coluna');

    if (automationsError) {
      console.error('❌ [Time Automations] Error fetching automations:', automationsError);
      throw automationsError;
    }

    if (!automations || automations.length === 0) {
      console.log('✅ [Time Automations] No active time-based automations found');
      return new Response(
        JSON.stringify({ message: 'No automations to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [Time Automations] Found ${automations.length} time-based automations`);

    let totalProcessed = 0;

    // Processar cada automação
    for (const automation of automations) {
      try {
        const trigger = automation.triggers[0];
        const triggerConfig = typeof trigger.trigger_config === 'string' 
          ? JSON.parse(trigger.trigger_config) 
          : trigger.trigger_config;

        const timeInMinutes = triggerConfig?.time_in_minutes || 0;
        
        if (timeInMinutes <= 0) {
          console.warn(`⚠️ [Time Automations] Invalid time config for automation ${automation.id}`);
          continue;
        }

        console.log(`🔍 [Time Automations] Checking automation "${automation.name}" (${timeInMinutes} minutes)`);

        // Buscar cards que estão na coluna há mais tempo que o configurado
        // e que ainda não tiveram essa automação executada
        const timeThreshold = new Date();
        timeThreshold.setMinutes(timeThreshold.getMinutes() - timeInMinutes);

        const { data: eligibleCards, error: cardsError } = await supabase
          .from('pipeline_cards')
          .select(`
            id,
            column_id,
            title,
            moved_to_column_at,
            pipeline_id,
            workspace_id
          `)
          .eq('column_id', automation.column_id)
          .lt('moved_to_column_at', timeThreshold.toISOString())
          .eq('status', 'aberto');

        if (cardsError) {
          console.error(`❌ [Time Automations] Error fetching cards for automation ${automation.id}:`, cardsError);
          continue;
        }

        if (!eligibleCards || eligibleCards.length === 0) {
          console.log(`✅ [Time Automations] No eligible cards for automation "${automation.name}"`);
          continue;
        }

        console.log(`📦 [Time Automations] Found ${eligibleCards.length} eligible cards for "${automation.name}"`);

        // Processar cada card elegível
        for (const card of eligibleCards) {
          // Verificar se já executou essa automação para esse card neste período
          const { data: existingExecution } = await supabase
            .from('crm_automation_executions')
            .select('id')
            .eq('automation_id', automation.id)
            .eq('card_id', card.id)
            .eq('column_id', automation.column_id)
            .gte('executed_at', card.moved_to_column_at)
            .maybeSingle();

          if (existingExecution) {
            console.log(`⏭️ [Time Automations] Automation already executed for card ${card.id}`);
            continue;
          }

          console.log(`🎬 [Time Automations] Executing automation for card "${card.title}" (${card.id})`);

          // Executar as ações via pipeline-management
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/pipeline-management/execute-automation-actions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'x-workspace-id': card.workspace_id
              },
              body: JSON.stringify({
                card_id: card.id,
                automation_id: automation.id,
                actions: automation.actions
              })
            });

            if (response.ok) {
              // Registrar execução
              await supabase
                .from('crm_automation_executions')
                .insert({
                  automation_id: automation.id,
                  card_id: card.id,
                  column_id: automation.column_id,
                  execution_type: 'tempo_na_coluna',
                  metadata: {
                    time_in_minutes: timeInMinutes,
                    moved_to_column_at: card.moved_to_column_at
                  }
                });

              totalProcessed++;
              console.log(`✅ [Time Automations] Automation executed successfully for card ${card.id}`);
            } else {
              console.error(`❌ [Time Automations] Failed to execute automation for card ${card.id}:`, await response.text());
            }
          } catch (execError) {
            console.error(`❌ [Time Automations] Error executing automation for card ${card.id}:`, execError);
          }
        }
      } catch (automationError) {
        console.error(`❌ [Time Automations] Error processing automation ${automation.id}:`, automationError);
      }
    }

    console.log(`✅ [Time Automations] Check completed. Processed ${totalProcessed} cards`);

    return new Response(
      JSON.stringify({ 
        message: 'Time-based automations processed', 
        processed: totalProcessed,
        automations_checked: automations.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [Time Automations] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
