import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Resend from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertConfig {
  id: string;
  workspace_id: string;
  provider: 'evolution' | 'zapi' | 'all';
  error_threshold_percent: number;
  time_window_minutes: number;
  email_notifications_enabled: boolean;
  toast_notifications_enabled: boolean;
  notification_emails: string[];
  is_active: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar todas as configurações de alerta ativas
    const { data: configs, error: configsError } = await supabaseClient
      .from('whatsapp_provider_alert_config')
      .select('*')
      .eq('is_active', true);

    if (configsError) {
      console.error('Error fetching alert configs:', configsError);
      throw configsError;
    }

    const alertsTriggered: any[] = [];

    for (const config of configs as AlertConfig[]) {
      const timeWindowStart = new Date(
        Date.now() - config.time_window_minutes * 60 * 1000
      );

      // Buscar logs no período
      let logsQuery = supabaseClient
        .from('whatsapp_provider_logs')
        .select('*')
        .eq('workspace_id', config.workspace_id)
        .gte('created_at', timeWindowStart.toISOString());

      if (config.provider !== 'all') {
        logsQuery = logsQuery.eq('provider', config.provider);
      }

      const { data: logs, error: logsError } = await logsQuery;

      if (logsError) {
        console.error('Error fetching logs:', logsError);
        continue;
      }

      if (!logs || logs.length === 0) {
        continue; // Sem dados para analisar
      }

      const errorCount = logs.filter((log: any) => log.result === 'error').length;
      const totalCount = logs.length;
      const errorRate = (errorCount / totalCount) * 100;

      // Verificar se ultrapassou o threshold
      if (errorRate >= config.error_threshold_percent) {
        const notifiedVia: string[] = [];

        // Criar alerta no banco
        const alertData = {
          workspace_id: config.workspace_id,
          provider: config.provider,
          error_rate: errorRate.toFixed(2),
          threshold_percent: config.error_threshold_percent,
          total_messages: totalCount,
          error_count: errorCount,
          time_window_start: timeWindowStart.toISOString(),
          time_window_end: new Date().toISOString(),
          notified_via: notifiedVia,
        };

        // Toast/Realtime - sempre inserir na tabela para disparar realtime
        if (config.toast_notifications_enabled) {
          notifiedVia.push('toast');
          notifiedVia.push('realtime');
        }

        // Email
        if (config.email_notifications_enabled && config.notification_emails?.length > 0) {
          try {
            const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
            
            await resend.emails.send({
              from: 'Alertas Tezeus <onboarding@resend.dev>',
              to: config.notification_emails,
              subject: `🚨 Alerta: Alta taxa de erro no provider ${config.provider.toUpperCase()}`,
              html: `
                <h2>Alerta de Taxa de Erro</h2>
                <p>A taxa de erro do provider <strong>${config.provider.toUpperCase()}</strong> ultrapassou o limite configurado.</p>
                <ul>
                  <li><strong>Taxa de Erro Atual:</strong> ${errorRate.toFixed(1)}%</li>
                  <li><strong>Limite Configurado:</strong> ${config.error_threshold_percent}%</li>
                  <li><strong>Total de Mensagens:</strong> ${totalCount}</li>
                  <li><strong>Mensagens com Erro:</strong> ${errorCount}</li>
                  <li><strong>Período:</strong> Últimos ${config.time_window_minutes} minutos</li>
                </ul>
                <p>Por favor, verifique a configuração do provider e os logs de erro.</p>
              `,
            });

            notifiedVia.push('email');
          } catch (emailError) {
            console.error('Error sending email alert:', emailError);
          }
        }

        alertData.notified_via = notifiedVia;

        const { error: insertError } = await supabaseClient
          .from('whatsapp_provider_alerts')
          .insert(alertData);

        if (insertError) {
          console.error('Error inserting alert:', insertError);
        } else {
          alertsTriggered.push(alertData);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts_triggered: alertsTriggered.length,
        alerts: alertsTriggered,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in monitor-provider-alerts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
