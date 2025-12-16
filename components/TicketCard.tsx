import React from 'react';
import { SupportTicketData } from '../types';

interface TicketCardProps {
  data: SupportTicketData;
}

export const TicketCard: React.FC<TicketCardProps> = ({ data }) => {
  return (
    <div className="bg-slate-800 border border-green-500/30 rounded-xl p-6 shadow-lg animate-fade-in-up">
      <div className="flex items-center space-x-3 mb-4 border-b border-slate-700 pb-3">
        <div className="h-10 w-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Ticket Generado</h3>
          <p className="text-xs text-slate-400">Enviado a soporte SMC</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Cliente</p>
          <p className="text-white font-medium">{data.name}</p>
          <p className="text-slate-300">{data.email}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Municipalidad</p>
          <p className="text-white font-medium">{data.municipality}</p>
        </div>
        <div className="md:col-span-2 bg-slate-700/50 p-3 rounded-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Sistema: <span className="text-blue-400">{data.system}</span></p>
          <p className="text-slate-200 mt-1">{data.issue}</p>
        </div>
      </div>
    </div>
  );
};