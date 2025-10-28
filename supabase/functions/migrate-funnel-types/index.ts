import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface FunnelStep {
  type: string;
  item_id: string;
  delay_seconds: number;
  order: number;
}

interface Funnel {
  id: string;
  workspace_id: string;
  title: string;
  steps: FunnelStep[];
}

const typeMapping: Record<string, string> = {
  'mensagens': 'message',
  'mensagem': 'message',
  'audios': 'audio',
  'audio': 'audio',
  'midias': 'media',
  'midia': 'media',
  'documentos': 'document',
  'documento': 'document',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Extrair workspace_id dos headers
    const workspaceId = req.headers.get('x-workspace-id');
    
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Workspace ID não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔄 Iniciando migração de funis para workspace: ${workspaceId}`);

    // Buscar todos os funis do workspace
    const { data: funnels, error: fetchError } = await supabase
      .from('quick_funnels')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (fetchError) {
      console.error('❌ Erro ao buscar funis:', fetchError);
      throw fetchError;
    }

    if (!funnels || funnels.length === 0) {
      console.log('ℹ️ Nenhum funil encontrado para migrar');
      return new Response(
        JSON.stringify({ 
          message: 'Nenhum funil encontrado',
          migrated: 0,
          total: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Encontrados ${funnels.length} funis para verificar`);

    let migratedCount = 0;
    const migrationReport: Array<{ id: string; title: string; changes: number }> = [];

    // Processar cada funil
    for (const funnel of funnels as Funnel[]) {
      let hasChanges = false;
      const updatedSteps = funnel.steps.map((step) => {
        const currentType = step.type.toLowerCase();
        const newType = typeMapping[currentType] || currentType;
        
        if (newType !== step.type) {
          hasChanges = true;
          console.log(`  🔄 Convertendo tipo: ${step.type} → ${newType}`);
          return { ...step, type: newType };
        }
        
        return step;
      });

      if (hasChanges) {
        // Atualizar funil no banco
        const { error: updateError } = await supabase
          .from('quick_funnels')
          .update({ steps: updatedSteps })
          .eq('id', funnel.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar funil ${funnel.id}:`, updateError);
        } else {
          migratedCount++;
          migrationReport.push({
            id: funnel.id,
            title: funnel.title,
            changes: updatedSteps.filter((s, i) => s.type !== funnel.steps[i].type).length
          });
          console.log(`✅ Funil "${funnel.title}" migrado com sucesso`);
        }
      } else {
        console.log(`ℹ️ Funil "${funnel.title}" já está com tipos corretos`);
      }
    }

    console.log(`🎉 Migração concluída: ${migratedCount}/${funnels.length} funis atualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Migração concluída com sucesso',
        total: funnels.length,
        migrated: migratedCount,
        alreadyCorrect: funnels.length - migratedCount,
        report: migrationReport
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao processar migração',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
