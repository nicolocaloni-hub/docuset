
import React, { useState } from 'react';
import { 
  Plus, Search, CheckCircle2, Clock, 
  ExternalLink, ArrowRight, Users, MoreVertical, Copy, Check, Bell, Timer
} from 'lucide-react';
import { DocumentRecord, DocumentStatus } from '../types';

interface DashboardProps {
  records: DocumentRecord[];
  onAddRecord: () => void;
  onViewLink: (record: DocumentRecord) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ records, onAddRecord, onViewLink }) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const stats = {
    total: records.length,
    signed: records.filter(r => r.status === DocumentStatus.SIGNED).length,
    pending: records.filter(r => r.status === DocumentStatus.PENDING).length,
  };

  const getStatusStyle = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.PENDING: return 'bg-amber-100 text-amber-700';
      case DocumentStatus.SENT: return 'bg-blue-100 text-blue-700';
      case DocumentStatus.VIEWED: return 'bg-purple-100 text-purple-700';
      case DocumentStatus.SIGNED: return 'bg-green-100 text-green-700';
      case DocumentStatus.EXPIRED: return 'bg-slate-100 text-slate-500';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`https://docuset.io/sign/${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    setOpenMenuId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Bentornato, Admin</h1>
          <p className="text-slate-500 mt-1 font-medium">Monitora lo stato dei documenti in tempo reale.</p>
        </div>
        <button onClick={onAddRecord} className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 font-bold"><Plus className="w-5 h-5 mr-2" />Nuova Richiesta</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Firme Completate', value: stats.signed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'In Sospeso', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Cast & Troupe', value: '42', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center group hover:border-blue-100 transition-all">
            <div className={`${stat.bg} p-4 rounded-2xl mr-4 transition-transform group-hover:scale-110`}><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-lg">Documenti Recenti</h3>
            <button className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group">Vedi Tutti <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-[10px] uppercase text-slate-400 font-bold tracking-widest">
                <tr><th className="px-6 py-4">Soggetto</th><th className="px-6 py-4">Tipo</th><th className="px-6 py-4">Stato</th><th className="px-6 py-4 text-right">Azioni</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800 text-sm">{record.recipientName}</p>
                      <p className="text-[10px] font-medium text-slate-400 uppercase">{record.role}</p>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">{record.documentType}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${getStatusStyle(record.status)}`}>{record.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button onClick={() => setOpenMenuId(openMenuId === record.id ? null : record.id)} className="p-2 text-slate-300 hover:text-slate-900"><MoreVertical className="w-4 h-4" /></button>
                      {openMenuId === record.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 text-left">
                          {record.status !== DocumentStatus.SIGNED && (
                            <>
                              <button className="w-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Bell className="w-4 h-4" /> Invia sollecito</button>
                              <button className="w-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Timer className="w-4 h-4" /> Imposta promemoria</button>
                            </>
                          )}
                          <button onClick={() => copyLink(record.id)} className="w-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                            {copiedId === record.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {copiedId === record.id ? "Copiato!" : "Copia link"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-extrabold text-slate-900 text-lg mb-6">Attività Recenti</h3>
          <div className="space-y-6">
            {records.slice(0, 3).map(activity => (
              <div key={activity.id} className="flex gap-4 group">
                <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center ${activity.status === DocumentStatus.SIGNED ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}><Clock className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="text-sm leading-tight"><span className="font-bold text-slate-900">{activity.recipientName}</span> <span className="text-slate-500">{activity.status === DocumentStatus.SIGNED ? 'ha firmato' : 'è in attesa'}</span> <span className="font-bold text-slate-700">{activity.documentType}</span></p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">Oggi</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
