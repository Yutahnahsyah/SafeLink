import { formatLoginCooldown } from '../services/loginCooldown';
import './LoginCooldownNotice.css';

export default function LoginCooldownNotice({ remainingSeconds }) {
  if (remainingSeconds <= 0) return null;
  const { message, countdown } = formatLoginCooldown(remainingSeconds);
  return <div className="login-cooldown-notice" role="alert" aria-live="polite"><p>{message}</p><span aria-hidden="true">{countdown} remaining</span></div>;
}
