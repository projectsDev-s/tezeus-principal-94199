import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";

type CallbackStatus = "processing" | "success" | "error";

const GoogleAgendaCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [message, setMessage] = useState("Finalizando a integração com a sua Google Agenda...");

  const headers = useMemo(() => {
    try {
      return getWorkspaceHeaders();
    } catch (error) {
      console.error("❌ Não foi possível recuperar o workspace para finalizar o OAuth", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error) {
      setStatus("error");
      setMessage(
        errorDescription ||
          "O Google cancelou o compartilhamento do calendário. Nenhuma permissão foi concedida."
      );
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setMessage("Parâmetros do Google ausentes. Refaça o processo de login.");
      return;
    }

    if (!headers) {
      setStatus("error");
      setMessage("Não encontramos o workspace atual. Abra novamente a página de integração.");
      return;
    }

    const finalizeIntegration = async () => {
      try {
        setStatus("processing");
        setMessage("Confirmando as permissões junto ao Google. Aguarde alguns segundos...");

        const { error: exchangeError } = await supabase.functions.invoke(
          "google-calendar-integration",
          {
            headers,
            body: {
              action: "exchange-code",
              code,
              state,
            },
          }
        );

        if (exchangeError) {
          throw exchangeError;
        }

        setStatus("success");
        setMessage("Integração concluída com sucesso! Redirecionando para o painel...");

        setTimeout(() => {
          navigate("/administracao-google-agenda", { replace: true });
        }, 2000);
      } catch (err: any) {
        console.error("❌ Falha ao finalizar o OAuth da Google Agenda", err);
        setStatus("error");
        setMessage(
          err?.message ?? "Não foi possível concluir a integração. Tente novamente mais tarde."
        );
      }
    };

    finalizeIntegration();
  }, [headers, location.search, navigate]);

  const icon = () => {
    if (status === "processing") {
      return <Loader2 className="w-10 h-10 text-primary animate-spin" />;
    }
    if (status === "success") {
      return <CheckCircle2 className="w-10 h-10 text-emerald-500" />;
    }
    return <ShieldAlert className="w-10 h-10 text-destructive" />;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-6">
      <Card className="max-w-xl w-full shadow-lg border-primary/10">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl">Integração com Google Agenda</CardTitle>
          <CardDescription>
            Estamos concluindo o processo de autorização segura diretamente com o Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="flex flex-col items-center gap-4">
            {icon()}
            <p className="text-base text-muted-foreground">{message}</p>
          </div>

          {status === "error" && (
            <Button
              variant="outline"
              onClick={() => navigate("/administracao-google-agenda", { replace: true })}
            >
              Voltar para configurações
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleAgendaCallback;

