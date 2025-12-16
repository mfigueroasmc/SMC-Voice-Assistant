import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from './audioUtils';

// Tool definition for finalizing the ticket
const submitTicketFunction: FunctionDeclaration = {
  name: 'submitTicket',
  description: 'Finalizes the support request by submitting the collected user information into a ticket.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Name of the user' },
      email: { type: Type.STRING, description: 'Email of the user' },
      municipality: { type: Type.STRING, description: 'The municipality the user is calling from' },
      system: { type: Type.STRING, description: 'The SMC system related to the inquiry (e.g., Contabilidad, Tesorería)' },
      issueDescription: { type: Type.STRING, description: 'A summary of the reported problem or requirement' },
    },
    required: ['name', 'email', 'municipality', 'system', 'issueDescription'],
  },
};

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime: number = 0;
  private sessionPromise: Promise<any> | null = null;
  private currentSession: any = null; // To hold the session object for closing
  
  private onTranscription: (text: string, isUser: boolean, isFinal: boolean) => void;
  private onVolumeChange: (volume: number) => void;
  private onConnect: () => void;
  private onDisconnect: () => void;
  private onError: (error: Error) => void;
  private onTicketSubmitted: (data: any) => void;

  constructor(
    callbacks: {
      onTranscription: (text: string, isUser: boolean, isFinal: boolean) => void;
      onVolumeChange: (volume: number) => void;
      onConnect: () => void;
      onDisconnect: () => void;
      onError: (error: Error) => void;
      onTicketSubmitted: (data: any) => void;
    }
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.onTranscription = callbacks.onTranscription;
    this.onVolumeChange = callbacks.onVolumeChange;
    this.onConnect = callbacks.onConnect;
    this.onDisconnect = callbacks.onDisconnect;
    this.onError = callbacks.onError;
    this.onTicketSubmitted = callbacks.onTicketSubmitted;
  }

  async connect() {
    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      this.inputNode = this.inputAudioContext.createGain();
      this.outputNode = this.outputAudioContext.createGain();
      
      // Analyser for visualizer
      this.analyser = this.outputAudioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.outputNode.connect(this.analyser);
      this.outputNode.connect(this.outputAudioContext.destination);

      // Start visualizer loop
      this.startVisualizer();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Session Opened');
            this.onConnect();
            
            if (!this.inputAudioContext) return;

            // Stream audio from mic
            const source = this.inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              if (this.sessionPromise) {
                this.sessionPromise.then((session) => {
                  this.currentSession = session;
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(this.inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            this.handleMessage(message);
          },
          onclose: (e) => {
            console.log('Session closed', e);
            this.onDisconnect();
          },
          onerror: (e) => {
            console.error('Session error', e);
            this.onError(new Error('Connection error occurred'));
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `
            Eres el Asistente Virtual Oficial de SMC (Sistemas Modulares de Computación), una empresa líder con más de 40 años proveyendo soluciones tecnológicas a municipalidades en Chile.
            
            TU PERFIL:
            - Tono: Profesional, corporativo, amable y eficiente.
            - Misión: Asistir a funcionarios municipales con problemas técnicos u operativos en los sistemas SMC.
            - Valores: Reflejas experiencia, confiabilidad y vocación de servicio.

            FLUJO DE LA CONVERSACIÓN:
            1. Saludo: "Bienvenido al soporte de SMC. Soy su asistente virtual. Para comenzar, ¿podría indicarme su nombre y correo institucional?"
            2. Identificación: Confirma los datos.
            3. Contexto: "¿De qué municipalidad nos llama?"
            4. Clasificación: "¿Con qué sistema tiene inconvenientes? (Ej: Contabilidad, Tesorería, PCV, JPL, Remuneraciones, etc.)"
            5. Diagnóstico: "Por favor, descríbame brevemente el problema."
            6. Acción: Si tienes una sugerencia rápida, dala. Luego di: "Perfecto. He registrado los antecedentes. Generaré un ticket de soporte inmediato para derivarlo a un consultor especializado."
            7. Ticket: Ejecuta la herramienta 'submitTicket'.
            8. Cierre: Confirma la creación del ticket y despídete cordialmente.
            
            IMPORTANTE:
            - Mantén las respuestas breves y directas, optimizadas para voz.
            - No inventes soluciones técnicas complejas, tu rol principal es el triaje y la creación del ticket.
          `,
          tools: [{ functionDeclarations: [submitTicketFunction] }],
          inputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" },
          outputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" }
        },
      });

    } catch (err) {
      this.onError(err as Error);
    }
  }

  private async handleMessage(message: LiveServerMessage) {
    // 1. Handle Audio
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext && this.outputNode) {
        // Auto-resume context if browser suspended it (common in auto-play scenarios)
        if (this.outputAudioContext.state === 'suspended') {
            await this.outputAudioContext.resume().catch(e => console.warn('Could not auto-resume audio context:', e));
        }

        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        const audioBuffer = await decodeAudioData(
            base64ToUint8Array(base64Audio),
            this.outputAudioContext,
            24000,
            1
        );
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode);
        source.addEventListener('ended', () => {
            this.sources.delete(source);
        });
        
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
    }

    // 2. Handle Interruption
    const interrupted = message.serverContent?.interrupted;
    if (interrupted) {
        console.log('Model interrupted user');
        this.sources.forEach(source => source.stop());
        this.sources.clear();
        this.nextStartTime = 0;
    }

    // 3. Handle Transcriptions
    if (message.serverContent?.outputTranscription) {
       this.onTranscription(message.serverContent.outputTranscription.text, false, !!message.serverContent.turnComplete);
    }
    if (message.serverContent?.inputTranscription) {
        this.onTranscription(message.serverContent.inputTranscription.text, true, !!message.serverContent.turnComplete);
    }

    // 4. Handle Tool Calls (The Ticket Submission)
    if (message.toolCall) {
        for (const fc of message.toolCall.functionCalls) {
            if (fc.name === 'submitTicket') {
                this.onTicketSubmitted(fc.args);
                
                // Respond to the tool call
                if (this.sessionPromise) {
                    this.sessionPromise.then(session => {
                        session.sendToolResponse({
                            functionResponses: {
                                id: fc.id,
                                name: fc.name,
                                response: { result: "Ticket creado. Referencia #SMC-" + Math.floor(Math.random() * 10000) }
                            }
                        });
                    });
                }
            }
        }
    }
  }

  private startVisualizer() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const update = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        this.onVolumeChange(average); // Normalize slightly if needed in UI
        requestAnimationFrame(update);
    };
    update();
  }

  async disconnect() {
    if (this.currentSession) {
        // Unfortunately typical WebSocket close isn't exposed directly on the session obj often,
        // but let's try to close inputs and contexts.
        // The API currently doesn't have an explicit 'disconnect' on the session object in all SDK versions,
        // but we can stop sending data.
    }

    this.sources.forEach(s => s.stop());
    this.sources.clear();
    
    if (this.inputAudioContext) {
        await this.inputAudioContext.close();
        this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
        await this.outputAudioContext.close();
        this.outputAudioContext = null;
    }
    this.analyser = null;
    this.onDisconnect();
  }
}