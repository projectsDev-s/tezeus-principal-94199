import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função helper para converter qualquer unidade de tempo para minutos
function convertToMinutes(value: number, unit: string): number {
  switch (unit) {
    case 'seconds':
      return value / 60;
    case 'minutes':
      return value;
    case 'hours':
      return value * 60;
    case 'days':
      return value * 1440;
    default:
      console.warn(`⚠️ Unknown time unit: ${unit}, treating as minutes`);
      return value;
  }
}

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
      .in('triggers.trigger_type', ['time_in_column', 'tempo_na_coluna']);

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

        // Suportar tanto configuração nova (time_unit + time_value) quanto antiga (time_in_minutes)
        let timeInMinutes: number;
        let originalValue: number;
        let originalUnit: string;

        if (triggerConfig?.time_unit && triggerConfig?.time_value) {
          // Nova configuração com unidade
          originalValue = parseFloat(triggerConfig.time_value);
          originalUnit = triggerConfig.time_unit;
          timeInMinutes = convertToMinutes(originalValue, originalUnit);
          
          console.log(`🔍 [Time Automations] Trigger type found: "${trigger.trigger_type}"`);
          console.log(`🔍 [Time Automations] Automation "${automation.name}": ${originalValue} ${originalUnit} = ${timeInMinutes.toFixed(4)} minutes`);
        } else if (triggerConfig?.time_in_minutes) {
          // Configuração antiga em minutos
          timeInMinutes = triggerConfig.time_in_minutes;
          originalValue = timeInMinutes;
          originalUnit = 'minutes';
          
          console.log(`🔍 [Time Automations] Automation "${automation.name}": ${timeInMinutes} minutes (legacy format)`);
        } else {
          console.warn(`⚠️ [Time Automations] Invalid time config for automation ${automation.id}:`, triggerConfig);
          continue;
        }
        
        if (timeInMinutes <= 0) {
          console.warn(`⚠️ [Time Automations] Invalid time value (${timeInMinutes} minutes) for automation ${automation.id}`);
          continue;
        }

        // Buscar cards que estão na coluna há mais tempo que o configurado
        // e que ainda não tiveram essa automação executada
        const timeThreshold = new Date();
        timeThreshold.setMinutes(timeThreshold.getMinutes() - timeInMinutes);

        console.log(`🔍 [Time Automations] Time threshold: ${timeThreshold.toISOString()} (NOW - ${timeInMinutes.toFixed(4)} min)`);
        console.log(`🔍 [Time Automations] Looking for cards in column ${automation.column_id} moved before ${timeThreshold.toISOString()}`);

        const { data: eligibleCards, error: cardsError } = await supabase
          .from('pipeline_cards')
          .select(`
            id,
            column_id,
            title,
            moved_to_column_at,
            pipeline_id
          `)
          .eq('column_id', automation.column_id)
          .lt('moved_to_column_at', timeThreshold.toISOString())
          .eq('status', 'aberto');

        console.log(`🔍 [Time Automations] Query result: ${eligibleCards?.length || 0} cards found, error: ${cardsError ? JSON.stringify(cardsError) : 'none'}`);

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
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            
            const response = await fetch(
              `${supabaseUrl}/functions/v1/pipeline-management/execute-automation-actions`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'apikey': serviceRoleKey,
                  'x-workspace-id': automation.workspace_id
                },
                body: JSON.stringify({
                  card_id: card.id,
                  automation_id: automation.id,
                  actions: automation.actions
                })
              }
            );

            const actionResult = await response.json();
            const actionError = !response.ok ? actionResult : null;

            if (!actionError) {
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
                    original_value: originalValue,
                    original_unit: originalUnit,
                    moved_to_column_at: card.moved_to_column_at
                  }
                });

              totalProcessed++;
              console.log(`✅ [Time Automations] Automation executed successfully for card ${card.id}`);
            } else {
              console.error(`❌ [Time Automations] Failed to execute automation for card ${card.id}:`, actionError);
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
