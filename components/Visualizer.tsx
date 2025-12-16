import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  volume: number;
  isActive: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive }) => {
  // Volume is 0-255 roughly from the service
  const bars = 5;
  
  return (
    <div className="flex items-center justify-center space-x-2 h-32">
      {isActive ? (
        Array.from({ length: bars }).map((_, i) => {
          // Create a wave effect
          const height = Math.max(10, Math.min(100, volume * (0.5 + Math.random())));
          return (
            <div
              key={i}
              className="w-4 bg-blue-500 rounded-full transition-all duration-75 ease-in-out shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              style={{ 
                height: `${height}%`,
                opacity: Math.max(0.3, volume / 100)
              }}
            />
          );
        })
      ) : (
        <div className="text-slate-500 text-sm font-light">Esperando conexión...</div>
      )}
    </div>
  );
};