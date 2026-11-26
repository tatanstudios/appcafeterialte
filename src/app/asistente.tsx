import { ComponentRef, Fragment, ReactNode, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Encabezado } from '@/components/encabezado';
import { Boton, Cargando } from '@/components/ui';
import { C, radio } from '@/constants/colores';
import { mensajeError } from '@/lib/api';
import { fecha } from '@/lib/formato';
import { getPreguntasSinRespuesta, MensajeAsistente, PreguntaSinRespuesta, preguntarAsistente, resolverPreguntaSinRespuesta } from '@/lib/operaciones';

const SUGERENCIAS = [
  '¿Cómo van las ventas de esta semana comparadas con la anterior?',
  '¿Cuál fue la utilidad estimada de este mes y qué la afecta más?',
  '¿Qué productos tienen más mermas y cuánto se perdió?',
  '¿A qué horas vendemos más y menos?',
  '¿Qué productos e insumos están bajo el mínimo?',
  '¿Hubo diferencias en los cierres de caja este mes?',
];

// **negrita** dentro de una línea
const enLinea = (texto: string): ReactNode[] =>
  texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**')
      ? <Text key={i} style={{ fontWeight: '800' }}>{parte.slice(2, -2)}</Text>
      : <Fragment key={i}>{parte}</Fragment>);

function TextoRespuesta({ texto }: { texto: string }) {
  return (
    <View style={{ gap: 3 }}>
      {texto.split('\n').map((linea, i) => {
        const vineta = linea.match(/^\s*[-*•]\s+(.*)$/);
        if (vineta) return <View key={i} style={{ flexDirection: 'row', gap: 6 }}><Text style={e.texto}>•</Text><Text style={[e.texto, { flex: 1 }]}>{enLinea(vineta[1])}</Text></View>;
        if (!linea.trim()) return <View key={i} style={{ height: 6 }} />;
        return <Text key={i} style={e.texto}>{enLinea(linea.replace(/^#+\s*/, ''))}</Text>;
      })}
    </View>
  );
}

// Preguntas que el asistente no pudo contestar: lo que falta agregarle
function SinRespuesta() {
  const [preguntas, setPreguntas] = useState<PreguntaSinRespuesta[] | null>(null);
  const [error, setError] = useState('');
  const [resolviendo, setResolviendo] = useState<number | null>(null);

  useEffect(() => {
    getPreguntasSinRespuesta().then((r) => setPreguntas(r.preguntas)).catch((err) => setError(mensajeError(err, 'No se pudieron cargar')));
  }, []);

  const resolver = async (id: number) => {
    setResolviendo(id);
    setError('');
    try {
      await resolverPreguntaSinRespuesta(id);
      setPreguntas((lista) => lista?.filter((p) => p.id !== id) ?? null);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo marcar como resuelta'));
    } finally {
      setResolviendo(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={e.contenido}>
      <Text style={e.ayuda}>Preguntas que el asistente no pudo responder porque todavía no tiene esa consulta. Sirven para decidir qué agregarle.</Text>
      {error ? <Text style={e.error}>{error}</Text> : null}
      {!preguntas && !error ? <Cargando /> : null}
      {preguntas?.length === 0 && <Text style={[e.ayuda, { paddingVertical: 24 }]}>No hay preguntas pendientes.</Text>}
      {preguntas?.map((p) => (
        <View key={p.id} style={e.tarjeta}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={e.meta}>{fecha(p.fecha)} · {p.usuario ?? '—'}</Text>
            <Text style={[e.texto, { fontWeight: '700' }]}>{p.pregunta}</Text>
            {p.falta ? <Text style={e.meta}>Falta: {p.falta}</Text> : null}
          </View>
          <Boton titulo="Marcar como resuelta" chico variante="exito" cargando={resolviendo === p.id}
            deshabilitado={resolviendo !== null} onPress={() => resolver(p.id)} />
        </View>
      ))}
    </ScrollView>
  );
}

// Asistente (IA): preguntas sobre ventas, utilidad, mermas, gastos... Solo lee los reportes del sistema.
export default function Asistente() {
  const [mensajes, setMensajes] = useState<MensajeAsistente[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState('');
  const [verSinRespuesta, setVerSinRespuesta] = useState(false);
  const lista = useRef<ComponentRef<typeof ScrollView>>(null);

  const enviar = async (pregunta: string) => {
    const limpia = pregunta.trim();
    if (!limpia || pensando) return;
    const nuevos: MensajeAsistente[] = [...mensajes, { role: 'user', content: limpia }];
    setMensajes(nuevos);
    setTexto('');
    setError('');
    setPensando(true);
    try {
      const r = await preguntarAsistente(nuevos);
      setMensajes([...nuevos, { role: 'assistant', content: r.respuesta, anotada: r.sin_respuesta.length > 0 }]);
    } catch (err) {
      setError(mensajeError(err, 'El asistente no respondió'));
      setMensajes(mensajes);
      setTexto(limpia);
    } finally {
      setPensando(false);
    }
  };

  return (
    <SafeAreaView style={e.pantalla} edges={['top', 'left', 'right', 'bottom']}>
      <Encabezado titulo="Asistente" subtitulo="Pregunta sobre ventas, utilidad, mermas, gastos e inventario"
        derecha={verSinRespuesta
          ? <Boton titulo="Volver al chat" chico variante="contorno" onPress={() => setVerSinRespuesta(false)} />
          : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Boton titulo="Sin respuesta" chico variante="contorno" onPress={() => setVerSinRespuesta(true)} />
              {mensajes.length > 0 && <Boton titulo="Nueva" chico variante="contorno" deshabilitado={pensando} onPress={() => { setMensajes([]); setError(''); }} />}
            </View>
          )} />
      {verSinRespuesta ? <SinRespuesta /> : (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={lista} contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}>
          {mensajes.length === 0 && (
            <View style={{ gap: 10 }}>
              <Text style={e.ayuda}>Pregunta lo que quieras saber del negocio. El asistente solo consulta los reportes; no puede cambiar nada.</Text>
              <View style={e.sugerencias}>
                {SUGERENCIAS.map((s) => (
                  <Pressable key={s} onPress={() => enviar(s)} style={({ pressed }) => [e.sugerencia, pressed && { opacity: 0.6 }]}>
                    <Text style={e.texto}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {mensajes.map((m, i) => (
            <View key={i} style={[e.burbuja, m.role === 'user' ? e.usuario : e.asistente]}>
              {m.role === 'user' ? <Text style={[e.texto, { color: '#fff' }]}>{m.content}</Text> : <TextoRespuesta texto={m.content} />}
              {m.anotada && <Text style={e.anotada}>Anotada para agregarla al asistente</Text>}
            </View>
          ))}
          {pensando && <View style={[e.burbuja, e.asistente]}><Text style={[e.texto, { color: C.suave }]}>Revisando los reportes…</Text></View>}
        </ScrollView>

        {error ? <Text style={e.error}>{error}</Text> : null}
        <View style={e.barra}>
          <TextInput value={texto} onChangeText={setTexto} placeholder="Ej.: ¿Cuánto vendimos ayer?" placeholderTextColor={C.tenue}
            multiline maxLength={2000} style={e.entrada} />
          <Boton titulo="Preguntar" onPress={() => enviar(texto)} deshabilitado={pensando || !texto.trim()} cargando={pensando} />
        </View>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  contenido: { padding: 16, gap: 12, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  ayuda: { fontSize: 15, color: C.suave, textAlign: 'center' },
  sugerencias: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sugerencia: { flexBasis: '48%', flexGrow: 1, backgroundColor: C.superficie, borderWidth: 1, borderColor: C.borde, borderRadius: radio, padding: 14 },
  burbuja: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  usuario: { alignSelf: 'flex-end', backgroundColor: C.primario },
  asistente: { alignSelf: 'flex-start', backgroundColor: C.superficie, borderWidth: 1, borderColor: C.borde },
  texto: { fontSize: 16, lineHeight: 22, color: C.texto },
  anotada: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: C.marcaClaro, color: '#92400E', fontSize: 13, fontWeight: '600', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  tarjeta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.superficie, borderWidth: 1, borderColor: C.borde, borderRadius: radio, padding: 14 },
  meta: { fontSize: 13, color: C.suave },
  error: { color: C.peligro, paddingHorizontal: 16, paddingBottom: 6 },
  barra: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: C.superficie, borderTopWidth: 1, borderColor: C.borde },
  entrada: { flex: 1, minHeight: 48, maxHeight: 140, fontSize: 16, color: C.texto, borderWidth: 1, borderColor: C.borde, borderRadius: radio, paddingHorizontal: 12, paddingVertical: 10 },
});
