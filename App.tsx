import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GeminiLiveService } from './services/geminiLiveService';
import { Visualizer } from './components/Visualizer';
import { Transcript } from './components/Transcript';
import { TicketCard } from './components/TicketCard';
import { ChatMessage, ConnectionState, SupportTicketData } from './types';

const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [volume, setVolume] = useState<number>(0);
  const [ticket, setTicket] = useState<SupportTicketData | null>(null);
  
  // Use a ref for the service to persist across renders without re-triggering effects
  const serviceRef = useRef<GeminiLiveService | null>(null);
  
  // Track if auto-connect has been attempted to prevent double calls in strict mode
  const hasAutoConnected = useRef(false);
  
  // Helper to append text to the latest message or create a new one
  const handleTranscription = useCallback((text: string, isUser: boolean, isFinal: boolean) => {
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      const isSameRole = lastMsg && ((isUser && lastMsg.role === 'user') || (!isUser && lastMsg.role === 'assistant'));
      
      if (isSameRole) {
         return [
           ...prev.slice(0, -1),
           { ...lastMsg, text: lastMsg.text + text }
         ];
      } else {
        return [
          ...prev,
          {
            id: Date.now().toString(),
            role: isUser ? 'user' : 'assistant',
            text: text,
            timestamp: new Date(),
          },
        ];
      }
    });
  }, []);

  const toggleConnection = useCallback(async () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      serviceRef.current?.disconnect();
      setConnectionState(ConnectionState.DISCONNECTED);
      setVolume(0);
    } else {
      setConnectionState(ConnectionState.CONNECTING);
      setTicket(null); // Reset previous ticket
      setMessages([]); // Clear chat

      serviceRef.current = new GeminiLiveService({
        onConnect: () => setConnectionState(ConnectionState.CONNECTED),
        onDisconnect: () => setConnectionState(ConnectionState.DISCONNECTED),
        onError: (e) => {
          console.error(e);
          alert("Error: " + e.message);
          setConnectionState(ConnectionState.ERROR);
        },
        onVolumeChange: (v) => setVolume(v),
        onTranscription: (text, isUser, isFinal) => {
           if (text) handleTranscription(text, isUser, isFinal);
        },
        onTicketSubmitted: (data) => {
          setTicket({
            name: data.name,
            email: data.email,
            municipality: data.municipality,
            system: data.system,
            issue: data.issueDescription
          });
        }
      });
      
      await serviceRef.current.connect();
    }
  }, [connectionState, handleTranscription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      serviceRef.current?.disconnect();
    };
  }, []);

  // Auto-connect on mount (Immediate Microphone Connection)
  useEffect(() => {
    if (!hasAutoConnected.current) {
      hasAutoConnected.current = true;
      // Small delay to ensure DOM is fully ready and to allow browser to register the intent if possible
      setTimeout(() => {
        if (connectionState === ConnectionState.DISCONNECTED) {
          console.log("Auto-connecting microphone...");
          toggleConnection();
        }
      }, 500);
    }
  }, [toggleConnection, connectionState]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row overflow-hidden">
      
      {/* Sidebar / Branding */}
      <div className="w-full md:w-80 bg-slate-800 border-r border-slate-700 flex flex-col z-10 shadow-xl">
        <div className="p-6 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-700 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg border border-blue-500/30">
              <span className="font-bold text-white text-xl tracking-tighter">SMC</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Sistemas Modulares</h1>
              <p className="text-[10px] text-blue-300 uppercase tracking-widest font-semibold">Tecnología Municipal</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
              <h2 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Estado del Sistema</h2>
              <div className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full shadow-sm ${
                  connectionState === ConnectionState.CONNECTED ? 'bg-emerald-500 animate-pulse shadow-emerald-500/50' : 
                  connectionState === ConnectionState.CONNECTING ? 'bg-amber-500 animate-bounce' : 'bg-rose-500'
                }`}></span>
                <span className="font-mono text-sm font-medium">
                  {connectionState === ConnectionState.CONNECTED ? 'EN LÍNEA (SOPORTE)' : 
                   connectionState === ConnectionState.CONNECTING ? 'INICIANDO...' : 'DESCONECTADO'}
                </span>
              </div>
            </div>

            <div className="text-slate-400 text-sm leading-relaxed border-l-2 border-slate-700 pl-3">
              <p className="mb-2"><strong>Atención Automática SMC</strong></p>
              <p>Reporte incidencias en sistemas municipales (Contabilidad, Tesorería, Patentes) de manera rápida hablando con nuestro agente.</p>
            </div>
          </div>

          <div className="mt-8">
             <button
              onClick={toggleConnection}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center space-x-3 ${
                connectionState === ConnectionState.CONNECTED 
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/50 hover:bg-rose-500/20' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'
              }`}
            >
              {connectionState === ConnectionState.CONNECTED ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75 18 6m0 0 2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m-10.5-2.12a2.25 2.25 0 0 0-1.591.636l-1.5 1.5a2.25 2.25 0 0 0 1.668 3.677c1.333 0 2.745-.08 4.125-.219.982-.097 1.916.485 2.308 1.41l1.528 3.666a2.25 2.25 0 0 0 2.795 1.288l1.5-1.5a2.25 2.25 0 0 0 .636-1.591" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6" />
                  </svg>
                  <span>Finalizar Sesión</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                  <span>Reconectar Agente</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Footer Credit */}
        <div className="p-4 border-t border-slate-700 text-center">
          <p className="text-[10px] text-slate-500">SMC Voice Intelligence • Powered by Gemini</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative h-screen">
        
        {/* Visualizer Area */}
        <div className="h-48 bg-slate-900 border-b border-slate-700/50 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
          
          <Visualizer volume={volume} isActive={connectionState === ConnectionState.CONNECTED} />
          
          <div className="mt-4 text-slate-400 font-light text-sm flex items-center space-x-2">
            {connectionState === ConnectionState.CONNECTED && (
               <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
            <span>
              {connectionState === ConnectionState.CONNECTED ? "SMC Soporte Escuchando..." : 
               connectionState === ConnectionState.CONNECTING ? "Estableciendo conexión segura..." : "Sistema en espera"}
            </span>
          </div>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 bg-slate-900 relative overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto relative z-0">
             <div className="max-w-3xl mx-auto h-full">
               <Transcript messages={messages} />
             </div>
          </div>
          
          {/* Ticket Overlay */}
          {ticket && (
            <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-center">
               <div className="max-w-2xl w-full">
                 <TicketCard data={ticket} />
               </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default App;