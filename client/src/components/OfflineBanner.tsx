import { useOffline } from "@/hooks/useOffline";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function OfflineBanner() {
  const { isOffline, isSlowConnection } = useOffline();

  if (!isOffline && !isSlowConnection) return null;

  return (
    <Alert 
      className={`fixed top-0 left-0 right-0 z-50 rounded-none border-x-0 border-t-0 ${
        isOffline 
          ? "bg-red-50 border-red-200 text-red-800" 
          : "bg-yellow-50 border-yellow-200 text-yellow-800"
      }`}
    >
      <div className="container flex items-center gap-3">
        {isOffline ? (
          <>
            <WifiOff className="h-5 w-5" />
            <div className="flex-1">
              <AlertTitle>Sem conexão com a internet</AlertTitle>
              <AlertDescription>
                Algumas funcionalidades podem estar limitadas. Verifique sua conexão.
              </AlertDescription>
            </div>
          </>
        ) : (
          <>
            <Wifi className="h-5 w-5" />
            <div className="flex-1">
              <AlertTitle>Conexão lenta detectada</AlertTitle>
              <AlertDescription>
                Sua conexão está lenta. O sistema pode demorar mais para carregar.
              </AlertDescription>
            </div>
          </>
        )}
      </div>
    </Alert>
  );
}
