import { useEffect, useState, useRef, useCallback } from 'react';
import { NotificationPayload } from '../../types/notification';
import { playNotificationSound } from './audio';

interface NotificationItemProps {
  notification: NotificationPayload;
  position: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  onDismiss: (id: string) => void;
  onExpire: (id: string) => void;
}

type AnimationState = 'entering' | 'visible' | 'exiting';

export function NotificationItem({ notification, position, onDismiss, onExpire }: NotificationItemProps) {
  const [animationState, setAnimationState] = useState<AnimationState>('entering');
  const [progress, setProgress] = useState(100);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const progressIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);
  const expiringRef = useRef<boolean>(false);

  const timeout = notification.timeout || 5000;
  const isRightSide = position.includes('right');
  const direction = isRightSide ? 'right' : 'left';

  const getIcon = () => {
    if (notification.icon) {
      return notification.icon;
    }
    switch (notification.type) {
      case 'blink':
        return '👁️';
      case 'posture':
        return '🪑';
      default:
        return '🔔';
    }
  };

  const handleExpire = useCallback(() => {
    if (expiringRef.current) return;
    expiringRef.current = true;
    
    setAnimationState('exiting');
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setTimeout(() => {
      onExpire(notification.id);
    }, 250);
  }, [onExpire, notification.id]);

  const handleDismiss = useCallback(() => {
    if (expiringRef.current) return;
    expiringRef.current = true;
    
    setAnimationState('exiting');
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setTimeout(() => {
      onDismiss(notification.id);
    }, 250);
  }, [onDismiss, notification.id]);

  useEffect(() => {
    startTimeRef.current = Date.now();

    // Play sound if enabled
    if (notification.soundEnabled !== false) {
      playNotificationSound(notification.type);
    }

    const enterTimer = setTimeout(() => {
      setAnimationState('visible');
    }, 300);

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current || Date.now());
      const remaining = Math.max(0, 100 - (elapsed / timeout) * 100);
      setProgress(remaining);
    }, 16);

    progressIntervalRef.current = progressInterval;

    const autoCloseTimer = setTimeout(() => {
      handleExpire();
    }, timeout);

    timeoutRef.current = autoCloseTimer;

    return () => {
      clearTimeout(enterTimer);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [timeout, handleExpire, notification.soundEnabled, notification.type]);

  const animationClass = 
    animationState === 'entering' 
      ? `entering from-${direction}` 
      : animationState === 'exiting' 
      ? `exiting to-${direction}` 
      : '';

  return (
    <div className={`notification-item ${animationClass}`}>
      <div className={`notification-accent ${notification.type}`} />
      <div className="notification-content">
        <div className={`notification-icon ${notification.type}`}>
          {getIcon()}
        </div>
        <div className="notification-body">
          <div className="notification-title">{notification.title}</div>
          <div className="notification-message">{notification.body}</div>
        </div>
        <button 
          className="notification-close" 
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
      <div className="notification-progress">
        <div 
          className="notification-progress-bar" 
          style={{ 
            width: `${progress}%`,
            transitionDuration: `${timeout}ms`
          }} 
        />
      </div>
    </div>
  );
}
