import { useState, useEffect } from "react";

/**
 * Hook para detectar se o usuário está offline ou com internet fraca
 */
export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Detectar conexão lenta
    if ("connection" in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        const checkConnection = () => {
          // Considera lenta se for 2G ou 3G
          const slowTypes = ["2g", "slow-2g"];
          setIsSlowConnection(
            slowTypes.includes(connection.effectiveType) ||
            connection.downlink < 0.5 // Menos de 0.5 Mbps
          );
        };

        checkConnection();
        connection.addEventListener("change", checkConnection);
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOffline, isSlowConnection };
}
