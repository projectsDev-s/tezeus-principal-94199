import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface Database {
  public: {
    Tables: {
      pipelines: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          type: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          name: string;
          type?: string;
          is_active?: boolean;
        };
      };
      pipeline_columns: {
        Row: {
          id: string;
          pipeline_id: string;
          name: string;
          color: string;
          order_position: number;
          created_at: string;
          permissions: string[]; // Array de user_ids
        };
        Insert: {
          pipeline_id: string;
          name: string;
          color?: string;
          order_position?: number;
          permissions?: string[];
        };
        Update: {
          permissions?: string[];
          order_position?: number;
        };
      };
      pipeline_cards: {
        Row: {
          id: string;
          pipeline_id: string;
          column_id: string;
          conversation_id: string | null;
          contact_id: string | null;
          title: string;
          description: string | null;
          value: number;
          status: string;
          tags: any;
          created_at: string;
          updated_at: string;
          responsible_user_id: string | null;
        };
        Insert: {
          pipeline_id: string;
          column_id: string;
          conversation_id?: string;
          contact_id?: string;
          title: string;
          description?: string;
          value?: number;
          status?: string;
          tags?: any;
          responsible_user_id?: string;
        };
      };
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Detailed logging for debugging
    console.log('🚀 Pipeline Management Function Started');
    console.log('📋 Headers received:', {
      'x-system-user-id': req.headers.get('x-system-user-id'),
      'x-system-user-email': req.headers.get('x-system-user-email'),
      'x-workspace-id': req.headers.get('x-workspace-id'),
      'user-agent': req.headers.get('user-agent')
    });

    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Enhanced user context validation and logging
    const userEmail = req.headers.get('x-system-user-email');
    const userId = req.headers.get('x-system-user-id');
    const workspaceId = req.headers.get('x-workspace-id');
    
    console.log('🔐 Authentication check:', { userId, userEmail, workspaceId });
    
    if (!userId || !userEmail) {
      console.error('❌ Missing user authentication headers');
      return new Response(
        JSON.stringify({ error: 'User authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!workspaceId) {
      console.error('❌ Missing workspace ID');
      return new Response(
        JSON.stringify({ error: 'Workspace ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Set user context for RLS with error handling
    try {
      console.log('🔧 Setting user context:', { userId, userEmail, workspaceId });
      
      const { error: contextError } = await supabaseClient.rpc('set_current_user_context', {
        user_id: userId,
        user_email: userEmail
      });
      
      if (contextError) {
        console.error('❌ RPC set_current_user_context failed:', contextError);
        throw contextError;
      }
      
      console.log('✅ User context set successfully');
    } catch (contextError) {
      console.error('❌ Failed to set user context:', contextError);
      return new Response(
        JSON.stringify({ error: 'Failed to set user context', details: contextError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { method } = req;
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(segment => segment !== '');
    const action = pathSegments[pathSegments.length - 1];
    
    console.log('📍 Request details:', { method, action, url: url.pathname });

    switch (action) {
      case 'pipelines':
        if (method === 'GET') {
          console.log('📊 Fetching pipelines for workspace:', workspaceId);
          
          const { data: pipelines, error } = await supabaseClient
            .from('pipelines')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('❌ Error fetching pipelines:', error);
            throw error;
          }
          
          console.log('✅ Pipelines fetched successfully:', pipelines?.length || 0, 'pipelines found');
          return new Response(JSON.stringify(pipelines || []), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          const body = await req.json();
          const { data: pipeline, error } = await supabaseClient
            .from('pipelines')
            .insert({
              workspace_id: workspaceId,
              name: body.name,
              type: body.type || 'padrao',
            })
            .select()
            .single();

          if (error) throw error;

          console.log('✅ Pipeline created successfully:', pipeline.id);

          return new Response(JSON.stringify(pipeline), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'DELETE') {
          const pipelineId = url.searchParams.get('id');
          
          if (!pipelineId) {
            return new Response(
              JSON.stringify({ error: 'Pipeline ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('🗑️ Deleting pipeline:', pipelineId);

          // Verificar se o pipeline tem cards
          const { count: cardsCount } = await supabaseClient
            .from('pipeline_cards')
            .select('*', { count: 'exact', head: true })
            .eq('pipeline_id', pipelineId);

          if (cardsCount && cardsCount > 0) {
            return new Response(
              JSON.stringify({ 
                error: 'Não é possível excluir um pipeline com negócios ativos',
                cardsCount 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Deletar colunas primeiro
          const { error: columnsError } = await supabaseClient
            .from('pipeline_columns')
            .delete()
            .eq('pipeline_id', pipelineId);

          if (columnsError) {
            console.error('❌ Error deleting columns:', columnsError);
            throw columnsError;
          }

          // Deletar o pipeline
          const { error: pipelineError } = await supabaseClient
            .from('pipelines')
            .delete()
            .eq('id', pipelineId)
            .eq('workspace_id', workspaceId);

          if (pipelineError) {
            console.error('❌ Error deleting pipeline:', pipelineError);
            throw pipelineError;
          }

          console.log('✅ Pipeline deleted successfully');

          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;

      case 'columns':
        if (method === 'GET') {
          const pipelineId = url.searchParams.get('pipeline_id');
          if (!pipelineId) {
            return new Response(
              JSON.stringify({ error: 'Pipeline ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: columns, error } = await supabaseClient
            .from('pipeline_columns')
            .select('*')
            .eq('pipeline_id', pipelineId)
            .order('order_position', { ascending: true });

          if (error) throw error;
          return new Response(JSON.stringify(columns), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          const body = await req.json();
          
          // Get next order position
          const { data: lastColumn } = await supabaseClient
            .from('pipeline_columns')
            .select('order_position')
            .eq('pipeline_id', body.pipeline_id)
            .order('order_position', { ascending: false })
            .limit(1)
            .single();

          const nextPosition = lastColumn ? lastColumn.order_position + 1 : 0;

          const { data: column, error } = await supabaseClient
            .from('pipeline_columns')
            .insert({
              pipeline_id: body.pipeline_id,
              name: body.name,
              color: body.color || '#808080',
              order_position: nextPosition,
            })
            .select()
            .single();

          if (error) throw error;
          return new Response(JSON.stringify(column), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'PUT') {
          const columnId = url.searchParams.get('id');
          if (!columnId) {
            return new Response(
              JSON.stringify({ error: 'Column ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const body = await req.json();
          
          // Prepare update data - accept permissions, order_position, and name
          const updateData: any = {};
          if (body.permissions !== undefined) {
            updateData.permissions = body.permissions;
          }
          if (body.view_all_deals_permissions !== undefined) {
            updateData.view_all_deals_permissions = body.view_all_deals_permissions;
          }
          if (body.order_position !== undefined) {
            updateData.order_position = body.order_position;
          }
          if (body.name !== undefined) {
            updateData.name = body.name;
          }
          
          console.log('🔄 Updating column:', columnId, 'with data:', updateData);
          
          const { data: column, error } = await supabaseClient
            .from('pipeline_columns')
            .update(updateData)
            .eq('id', columnId)
            .select()
            .single();

          if (error) throw error;
          return new Response(JSON.stringify(column), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'DELETE') {
          const columnId = url.searchParams.get('id');
          if (!columnId) {
            return new Response(
              JSON.stringify({ error: 'Column ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('🗑️ Deleting column:', columnId);

          // First, check if there are any cards in this column
          const { data: cards, error: cardsError } = await supabaseClient
            .from('pipeline_cards')
            .select('id')
            .eq('column_id', columnId);

          if (cardsError) throw cardsError;

          if (cards && cards.length > 0) {
            return new Response(
              JSON.stringify({ 
                error: 'Cannot delete column with existing cards. Move cards to another column first.',
                cardsCount: cards.length 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Delete the column
          const { error } = await supabaseClient
            .from('pipeline_columns')
            .delete()
            .eq('id', columnId);

          if (error) throw error;

          console.log('✅ Column deleted successfully:', columnId);
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;

      case 'cards':
        if (method === 'GET') {
          const pipelineId = url.searchParams.get('pipeline_id');
          if (!pipelineId) {
            return new Response(
              JSON.stringify({ error: 'Pipeline ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: cards, error } = await supabaseClient
            .from('pipeline_cards')
            .select(`
              *,
              contact:contacts(
                *,
                contact_tags(
                  tag_id,
                  tags!contact_tags_tag_id_fkey(id, name, color)
                )
              ),
              conversation:conversations(
                *,
                connection:connections!conversations_connection_id_fkey(
                  id,
                  instance_name,
                  phone_number,
                  status,
                  metadata
                )
              ),
              responsible_user:system_users!responsible_user_id(id, name)
            `)
            .eq('pipeline_id', pipelineId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return new Response(JSON.stringify(cards), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          try {
            const body = await req.json();
            console.log('📝 Creating card with data:', body);
            
            const { data: card, error } = await supabaseClient
              .from('pipeline_cards')
              .insert({
                pipeline_id: body.pipeline_id,
                column_id: body.column_id,
                conversation_id: body.conversation_id,
                contact_id: body.contact_id,
                title: body.title,
                description: body.description,
                value: body.value || 0,
                status: body.status || 'aberto',
                tags: body.tags || [],
                responsible_user_id: body.responsible_user_id,
              })
              .select(`
                *,
                contact:contacts(
                  *,
                  contact_tags(
                    tag_id,
                    tags!contact_tags_tag_id_fkey(id, name, color)
                  )
                ),
                conversation:conversations(
                  *,
                  connection:connections!conversations_connection_id_fkey(
                    id,
                    instance_name,
                    phone_number,
                    status,
                    metadata
                  )
                ),
                responsible_user:system_users!responsible_user_id(id, name)
              `)
              .single();

            if (error) {
              console.error('❌ Database error creating card:', error);
              throw error;
            }
            
            console.log('✅ Card created successfully:', card);
            return new Response(JSON.stringify(card), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (err) {
            console.error('❌ Error in POST cards:', err);
            throw err;
          }
        }

        if (method === 'PUT') {
          try {
            const body = await req.json();
            const cardId = url.searchParams.get('id');
            if (!cardId) {
              return new Response(
                JSON.stringify({ error: 'Card ID required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            console.log('📝 Updating card:', cardId, 'with data:', body);

            // Validate that column belongs to the target pipeline if both are being updated
            if (body.column_id && body.pipeline_id) {
              const { data: column, error: colError } = await supabaseClient
                .from('pipeline_columns')
                .select('pipeline_id')
                .eq('id', body.column_id)
                .single();

              if (colError) {
                console.error('❌ Column not found:', body.column_id);
                throw new Error('Coluna não encontrada');
              }

              if (column.pipeline_id !== body.pipeline_id) {
                console.error('❌ Column does not belong to pipeline:', {
                  column_id: body.column_id,
                  column_pipeline: column.pipeline_id,
                  target_pipeline: body.pipeline_id
                });
                throw new Error('A coluna não pertence ao pipeline de destino');
              }
            }

            const updateData: any = {};
            if (body.column_id !== undefined) updateData.column_id = body.column_id;
            if (body.pipeline_id !== undefined) updateData.pipeline_id = body.pipeline_id;
            if (body.title !== undefined) updateData.title = body.title;
            if (body.description !== undefined) updateData.description = body.description;
            if (body.value !== undefined) updateData.value = body.value;
            if (body.status !== undefined) updateData.status = body.status;
            if (body.tags !== undefined) updateData.tags = body.tags;
            if (body.responsible_user_id !== undefined) updateData.responsible_user_id = body.responsible_user_id;

            console.log('🔄 Update data prepared:', updateData);

            const { data: card, error } = await supabaseClient
              .from('pipeline_cards')
              .update(updateData)
              .eq('id', cardId)
              .select()
              .single();

            if (error) {
              console.error('❌ Database error updating card:', error);
              throw error;
            }
            
            console.log('✅ Card updated successfully:', card);
            
            // ✅ Se o responsável foi atualizado E o card tem conversa associada, sincronizar
            if (body.responsible_user_id !== undefined && card.conversation_id) {
              console.log(`🔄 Syncing conversation ${card.conversation_id} with responsible user ${body.responsible_user_id}`);
              
              // Buscar estado atual da conversa
              const { data: currentConversation } = await supabaseClient
                .from('conversations')
                .select('assigned_user_id, workspace_id')
                .eq('id', card.conversation_id)
                .single();
              
              if (currentConversation) {
                // Atualizar a conversa com o novo responsável
                const { error: convUpdateError } = await supabaseClient
                  .from('conversations')
                  .update({
                    assigned_user_id: body.responsible_user_id,
                    assigned_at: new Date().toISOString(),
                    status: 'open'
                  })
                  .eq('id', card.conversation_id);
                
                if (convUpdateError) {
                  console.error('❌ Error updating conversation:', convUpdateError);
                } else {
                  // Determinar se é aceite ou transferência
                  const action = currentConversation.assigned_user_id ? 'transfer' : 'accept';
                  
                  // Registrar no log de auditoria
                  const { error: logError } = await supabaseClient
                    .from('conversation_assignments')
                    .insert({
                      conversation_id: card.conversation_id,
                      from_assigned_user_id: currentConversation.assigned_user_id,
                      to_assigned_user_id: body.responsible_user_id,
                      changed_by: systemUserId,
                      action: action
                    });
                  
                  if (logError) {
                    console.error('❌ Error logging assignment:', logError);
                  }
                  
                  console.log(`✅ Conversa ${action === 'accept' ? 'aceita' : 'transferida'} automaticamente para ${body.responsible_user_id}`);
                }
              }
            }
            
            return new Response(JSON.stringify(card), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (error) {
            console.error('❌ Error in PUT /cards:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return new Response(
              JSON.stringify({ error: errorMessage }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        if (method === 'DELETE') {
          const cardId = url.searchParams.get('id');
          if (!cardId) {
            return new Response(
              JSON.stringify({ error: 'Card ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('🗑️ Deleting card:', cardId);

          // Verificar se o card existe e pertence ao workspace
          const { data: card, error: fetchError } = await supabaseClient
            .from('pipeline_cards')
            .select('pipeline_id, pipelines!inner(workspace_id)')
            .eq('id', cardId)
            .single();

          if (fetchError || !card) {
            return new Response(
              JSON.stringify({ error: 'Card not found or access denied' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Verificar se o workspace do card é o mesmo do header
          if (card.pipelines.workspace_id !== workspaceId) {
            return new Response(
              JSON.stringify({ error: 'Card does not belong to current workspace' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Deletar o card (CASCADE já está configurado no banco)
          const { error } = await supabaseClient
            .from('pipeline_cards')
            .delete()
            .eq('id', cardId);

          if (error) throw error;

          console.log('✅ Card deleted successfully:', cardId);
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;

      case 'actions':
        console.log('🎯 Entering actions case, method:', method);
        if (method === 'GET') {
          const pipelineId = url.searchParams.get('pipeline_id');
          console.log('📥 GET actions - pipeline_id:', pipelineId);
          if (!pipelineId) {
            return new Response(
              JSON.stringify({ error: 'Pipeline ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: pipelineActions, error } = await supabaseClient
            .from('pipeline_actions')
            .select('*')
            .eq('pipeline_id', pipelineId)
            .order('order_position');

          if (error) {
            console.error('❌ Error fetching actions:', error);
            throw error;
          }
          
          console.log('✅ Actions fetched successfully:', pipelineActions?.length || 0);
          return new Response(JSON.stringify(pipelineActions || []), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST') {
          try {
            const body = await req.json();
            console.log('📝 Creating pipeline action with data:', body);
            
            const { data: actionData, error } = await supabaseClient
              .from('pipeline_actions')
              .insert({
                pipeline_id: body.pipeline_id,
                action_name: body.action_name,
                target_pipeline_id: body.target_pipeline_id,
                target_column_id: body.target_column_id,
                deal_state: body.deal_state,
                order_position: body.order_position || 0,
              })
              .select()
              .single();

            if (error) {
              console.error('❌ Database error creating action:', error);
              throw error;
            }
            
            console.log('✅ Pipeline action created successfully:', actionData);
            return new Response(JSON.stringify(actionData), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (err) {
            console.error('❌ Error in POST actions:', err);
            throw err;
          }
        }

        if (method === 'PUT') {
          try {
            const actionId = url.searchParams.get('id');
            if (!actionId) {
              return new Response(
                JSON.stringify({ error: 'Action ID required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            const body = await req.json();
            console.log('📝 Updating pipeline action:', actionId, body);
            
            const { data: actionData, error } = await supabaseClient
              .from('pipeline_actions')
              .update({
                action_name: body.action_name,
                target_pipeline_id: body.target_pipeline_id,
                target_column_id: body.target_column_id,
                deal_state: body.deal_state,
                order_position: body.order_position,
              })
              .eq('id', actionId)
              .select()
              .single();

            if (error) throw error;
            
            console.log('✅ Pipeline action updated successfully');
            return new Response(JSON.stringify(actionData), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (error) {
            console.error('❌ Error in PUT /actions:', error);
            throw error;
          }
        }

        if (method === 'DELETE') {
          const actionId = url.searchParams.get('id');
          if (!actionId) {
            return new Response(
              JSON.stringify({ error: 'Action ID required' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('🗑️ Deleting pipeline action:', actionId);

          const { error } = await supabaseClient
            .from('pipeline_actions')
            .delete()
            .eq('id', actionId);

          if (error) throw error;

          console.log('✅ Pipeline action deleted successfully:', actionId);
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.warn('⚠️ No matching method for actions case, method:', method);
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Melhor captura de erros para debugging
    console.error('❌ Pipeline Management Function Error:', {
      error: error,
      errorType: typeof error,
      errorString: String(error),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      errorKeys: error ? Object.keys(error) : [],
    });
    
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      // Capturar erros do Supabase que não são instâncias de Error
      errorMessage = (error as any).message || (error as any).error_description || JSON.stringify(error);
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
        timestamp: new Date().toISOString(),
        action: 'pipeline-management'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});