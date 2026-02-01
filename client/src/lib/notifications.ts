/**
 * Sistema de notificações sonoras e vibração
 * Para alertar quando pedidos ficam prontos
 */

// Instância do áudio para notificação
let notificationAudio: HTMLAudioElement | null = null;

// Contexto de áudio para gerar sons programaticamente
let audioContext: AudioContext | null = null;

/**
 * Inicializa o contexto de áudio (deve ser chamado após interação do usuário)
 */
export function initAudioContext(): void {
  if (!audioContext && typeof window !== 'undefined') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
}

/**
 * Toca um som de "plim" agradável quando o pedido fica pronto
 */
export async function playOrderReadySound(): Promise<void> {
  try {
    // Tenta usar o contexto de áudio para gerar um som agradável
    if (!audioContext) {
      initAudioContext();
    }

    if (audioContext) {
      // Resume o contexto se estiver suspenso
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Cria um som de "plim" usando osciladores
      const now = audioContext.currentTime;
      
      // Primeiro tom (mais alto)
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.frequency.setValueAtTime(880, now); // Nota A5
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Segundo tom (harmônico)
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.setValueAtTime(1318.5, now + 0.1); // Nota E6
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.2, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.5);

      // Terceiro tom (finalização)
      const osc3 = audioContext.createOscillator();
      const gain3 = audioContext.createGain();
      osc3.connect(gain3);
      gain3.connect(audioContext.destination);
      osc3.frequency.setValueAtTime(1760, now + 0.2); // Nota A6
      osc3.type = 'sine';
      gain3.gain.setValueAtTime(0, now);
      gain3.gain.setValueAtTime(0.15, now + 0.2);
      gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc3.start(now + 0.2);
      osc3.stop(now + 0.6);
    }
  } catch (error) {
    console.warn('[Notification] Erro ao tocar som:', error);
  }
}

/**
 * Faz o dispositivo vibrar (se suportado)
 * @param pattern - Padrão de vibração em ms [vibrar, pausar, vibrar, ...]
 */
export function vibrate(pattern: number | number[] = [200, 100, 200]): void {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (error) {
    console.warn('[Notification] Vibração não suportada:', error);
  }
}

/**
 * Notifica o usuário que o pedido está pronto
 * Combina som + vibração + notificação do sistema (se permitido)
 */
export async function notifyOrderReady(orderNumber?: number): Promise<void> {
  // Toca o som
  await playOrderReadySound();
  
  // Vibra o dispositivo
  vibrate([200, 100, 200, 100, 300]);
  
  // Tenta mostrar notificação do sistema
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('🎉 Pedido Pronto!', {
        body: orderNumber 
          ? `Seu pedido #${orderNumber} está pronto para retirada!`
          : 'Seu pedido está pronto para retirada!',
        icon: '/favicon.ico',
        tag: 'order-ready',
        requireInteraction: true,
      });
    } catch (error) {
      console.warn('[Notification] Erro ao mostrar notificação:', error);
    }
  }
}

/**
 * Solicita permissão para notificações do sistema
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
}

/**
 * Verifica se as notificações estão habilitadas
 */
export function isNotificationEnabled(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Verifica se a vibração é suportada
 */
export function isVibrationSupported(): boolean {
  return 'vibrate' in navigator;
}
