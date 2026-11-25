import { Redirect } from 'expo-router';

import { useSesion } from '@/lib/sesion';

// Lleva al primer paso que falte: servidor → inicio de sesión → caja → menú
export default function Inicio() {
  const { servidor, usuario, cajaId, cajaFija } = useSesion();

  if (!servidor) return <Redirect href="/servidor" />;
  if (!usuario) return <Redirect href="/login" />;
  // Un mesero sin caja asignada entra al menú (ahí ve el aviso); los demás eligen la caja de la tablet
  if (!cajaId && !cajaFija) return <Redirect href="/caja" />;
  return <Redirect href="/inicio" />;
}
