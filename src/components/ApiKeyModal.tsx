import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Code,
  Terminal,
  Play,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles,
  Server
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { ApiKeyRecord } from '../types';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'keys' | 'tester' | 'docs'>('keys');
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // API Tester state
  const [testerKey, setTesterKey] = useState<string>('');
  const [testerRcNo, setTesterRcNo] = useState<string>('223868315896');
  const [testerEndpoint, setTesterEndpoint] = useState<'v1_query' | 'v1_rest'>('v1_query');
  const [testerLoading, setTesterLoading] = useState(false);
  const [testerResult, setTesterResult] = useState<{ status: number; data: any; duration: number } | null>(null);

  // Code Snippet language
  const [snippetLang, setSnippetLang] = useState<'curl' | 'javascript' | 'python'>('curl');

  const fetchKeys = async () => {
    setIsLoadingKeys(true);
    try {
      const res = await apiFetch('/api/keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        if (data.keys && data.keys.length > 0 && !testerKey) {
          setTesterKey(data.keys[0].key);
        }
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setIsLoadingKeys(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKeys();
    }
  }, [isOpen]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;

    setIsCreating(true);
    try {
      const res = await apiFetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim() || 'Remote Client App' })
      });
      if (res.ok) {
        setNewLabel('');
        await fetchKeys();
      }
    } catch (err) {
      console.error('Failed to create key:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (key: string) => {
    try {
      const res = await apiFetch(`/api/keys/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchKeys();
      }
    } catch (err) {
      console.error('Failed to revoke key:', err);
    }
  };

  const copyToClipboard = (text: string, isKey: boolean = true) => {
    navigator.clipboard.writeText(text);
    if (isKey) {
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2000);
    } else {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  const toggleReveal = (key: string) => {
    setRevealedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const runApiTest = async () => {
    setTesterLoading(true);
    setTesterResult(null);
    const start = Date.now();

    try {
      let url = '';
      const headers: Record<string, string> = { 'Accept': 'application/json' };

      if (testerEndpoint === 'v1_query') {
        url = `/api/v1/extract?rcNo=${encodeURIComponent(testerRcNo)}&apiKey=${encodeURIComponent(testerKey)}`;
      } else {
        url = `/api/v1/card/${encodeURIComponent(testerRcNo)}`;
        headers['X-API-Key'] = testerKey;
      }

      const res = await fetch(url, { headers });
      const duration = Date.now() - start;
      const data = await res.json();
      setTesterResult({ status: res.status, data, duration });

      // Refresh keys to see request counter increment
      fetchKeys();
    } catch (err: any) {
      setTesterResult({
        status: 500,
        data: { error: err.message || 'Network call failed' },
        duration: Date.now() - start
      });
    } finally {
      setTesterLoading(false);
    }
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const sampleKey = testerKey || (keys[0]?.key ?? 'cg_rc_live_key_9f8a7b6c');

  const getCodeSnippet = () => {
    if (snippetLang === 'curl') {
      return `# Method 1: Header Authentication (Recommended)
curl -X GET "${baseUrl}/api/v1/extract?rcNo=${testerRcNo}" \\
  -H "X-API-Key: ${sampleKey}"

# Method 2: RESTful Endpoint with Header
curl -X GET "${baseUrl}/api/v1/card/${testerRcNo}" \\
  -H "Authorization: Bearer ${sampleKey}"

# Method 3: Query Parameter Authentication
curl -X GET "${baseUrl}/api/v1/extract?rcNo=${testerRcNo}&apiKey=${sampleKey}"`;
    }

    if (snippetLang === 'javascript') {
      return `// JavaScript / Node.js Remote Pull Example
async function fetchRationCard(rcNo) {
  const url = \`${baseUrl}/api/v1/extract?rcNo=\${rcNo}\`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': '${sampleKey}',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch card details');
  }

  const cardDetails = await response.json();
  console.log('Head of Family:', cardDetails.headName);
  console.log('District:', cardDetails.district);
  console.log('Members:', cardDetails.members);
  return cardDetails;
}

// Execute
fetchRationCard('${testerRcNo}');`;
    }

    if (snippetLang === 'python') {
      return `# Python requests library remote pull example
import requests

url = "${baseUrl}/api/v1/extract"
headers = {
    "X-API-Key": "${sampleKey}",
    "Accept": "application/json"
}
params = {
    "rcNo": "${testerRcNo}",
    "fpsId": "412001080"
}

response = requests.get(url, headers=headers, params=params)

if response.status_code == 200:
    data = response.json()
    print(f"Head Name: {data.get('headName')}")
    print(f"Card Scheme: {data.get('cardType')}")
    print(f"Family Members: {len(data.get('members', []))}")
else:
    print(f"Error {response.status_code}: {response.json()}")`;
    }

    return '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Remote API Access & Keys</h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  REST API v1
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Generate API keys to pull live CG FCS ration card extractions from python scripts, mobile apps, or external ERPs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-6 pt-3 border-b border-slate-800 bg-slate-900 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
              activeTab === 'keys'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Manage API Keys ({keys.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tester')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
              activeTab === 'tester'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Interactive API Tester</span>
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
              activeTab === 'docs'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Integration Code Snippets</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: API KEYS MANAGEMENT */}
          {activeTab === 'keys' && (
            <div className="space-y-6">
              {/* Create API Key Form */}
              <form onSubmit={handleCreateKey} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3">
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    API Key Description / Label
                  </label>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Python Automation Script, Mobile App, ERP Service"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
                <div className="w-full sm:w-auto self-end">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Generate API Key</span>
                  </button>
                </div>
              </form>

              {/* Keys List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Active API Credentials
                </h3>

                {isLoadingKeys ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
                    Loading keys...
                  </div>
                ) : keys.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
                    No API keys created yet. Generate one above to enable remote access.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {keys.map((k) => {
                      const isRevealed = revealedKeys[k.key];
                      const masked = `${k.key.substring(0, 10)}••••••••${k.key.substring(k.key.length - 4)}`;
                      const displayKey = isRevealed ? k.key : masked;

                      return (
                        <div
                          key={k.key}
                          className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white">{k.label}</span>
                              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {k.requestCount} Requests
                              </span>
                              {k.lastUsed && (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                  <Activity className="w-3 h-3" />
                                  Last used {new Date(k.lastUsed).toLocaleTimeString()}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <code className="bg-slate-900 border border-slate-800 text-emerald-300 px-2.5 py-1 rounded font-mono text-xs select-all">
                                {displayKey}
                              </code>

                              <button
                                onClick={() => toggleReveal(k.key)}
                                className="p-1 text-slate-400 hover:text-white transition"
                                title={isRevealed ? 'Hide Key' : 'Reveal Key'}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => copyToClipboard(k.key, true)}
                                className="p-1 text-slate-400 hover:text-emerald-400 transition"
                                title="Copy API Key"
                              >
                                {copiedKey === k.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-500">
                              Created on {new Date(k.createdAt).toLocaleDateString()} at {new Date(k.createdAt).toLocaleTimeString()}
                            </p>
                          </div>

                          <div>
                            <button
                              onClick={() => handleRevokeKey(k.key)}
                              className="px-3 py-1.5 border border-red-950 bg-red-950/30 text-red-400 hover:bg-red-900/40 hover:text-red-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Revoke Key</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE API TESTER */}
          {activeTab === 'tester' && (
            <div className="space-y-6">
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400" />
                  Live API Request Sandbox
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Select API Credential Key
                    </label>
                    <select
                      value={testerKey}
                      onChange={(e) => setTesterKey(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {keys.map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.label} ({k.key.substring(0, 10)}...)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Endpoint Format
                    </label>
                    <select
                      value={testerEndpoint}
                      onChange={(e) => setTesterEndpoint(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="v1_query">GET /api/v1/extract?rcNo=...</option>
                      <option value="v1_rest">GET /api/v1/card/:rcNo (X-API-Key)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Ration Card Number (rcNo)
                    </label>
                    <input
                      type="text"
                      value={testerRcNo}
                      onChange={(e) => setTesterRcNo(e.target.value)}
                      placeholder="e.g. 223868315896"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={runApiTest}
                    disabled={testerLoading || !testerRcNo.trim() || !testerKey}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {testerLoading ? (
                      <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    <span>{testerLoading ? 'Sending Live API Request...' : 'Execute Live API Request'}</span>
                  </button>
                </div>
              </div>

              {/* Response Inspector */}
              {testerResult && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden space-y-0">
                  <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        testerResult.status === 200
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        HTTP {testerResult.status} {testerResult.status === 200 ? 'OK' : 'ERROR'}
                      </span>
                      <span className="text-slate-400">{testerResult.duration}ms</span>
                    </div>
                    <span className="text-slate-400">Response Body (JSON)</span>
                  </div>
                  <pre className="p-4 text-xs font-mono text-emerald-300 max-h-80 overflow-auto bg-slate-950/90 leading-relaxed select-all">
                    {JSON.stringify(testerResult.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CODE SNIPPETS */}
          {activeTab === 'docs' && (
            <div className="space-y-6">
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Code Snippets & Examples
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg">
                    <button
                      onClick={() => setSnippetLang('curl')}
                      className={`px-3 py-1 text-xs font-medium rounded transition ${
                        snippetLang === 'curl' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      cURL
                    </button>
                    <button
                      onClick={() => setSnippetLang('javascript')}
                      className={`px-3 py-1 text-xs font-medium rounded transition ${
                        snippetLang === 'javascript' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      JavaScript
                    </button>
                    <button
                      onClick={() => setSnippetLang('python')}
                      className={`px-3 py-1 text-xs font-medium rounded transition ${
                        snippetLang === 'python' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Python
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed select-all">
                    {getCodeSnippet()}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(getCodeSnippet(), false)}
                    className="absolute top-3 right-3 p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition flex items-center gap-1.5 text-xs"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Endpoint Reference Table */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  REST API Endpoint Reference (Protected by API Key)
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold font-mono rounded text-[11px]">GET</span>
                      <code className="text-white font-mono font-semibold">/api/v1/extract</code>
                    </div>
                    <span className="text-slate-400 text-[11px]">Extract single card: <code className="text-emerald-300">?rcNo=...&fpsId=...</code></span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold font-mono rounded text-[11px]">GET</span>
                      <code className="text-white font-mono font-semibold">/api/v1/cards</code>
                    </div>
                    <span className="text-slate-400 text-[11px]">Query Cloud SQL DB: <code className="text-emerald-300">?q=...&district=...&page=1</code></span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold font-mono rounded text-[11px]">GET</span>
                      <code className="text-white font-mono font-semibold">/api/v1/cards/:rcNo</code>
                    </div>
                    <span className="text-slate-400 text-[11px]">Fetch card + family members stored in PostgreSQL</span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 font-bold font-mono rounded text-[11px]">GET</span>
                      <code className="text-white font-mono font-semibold">/api/v1/epos/districts</code>
                    </div>
                    <span className="text-slate-400 text-[11px]">List all 33 Chhattisgarh districts</span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 font-bold font-mono rounded text-[11px]">GET</span>
                      <code className="text-white font-mono font-semibold">/api/v1/epos/blocks</code>
                    </div>
                    <span className="text-slate-400 text-[11px]">Query params: <code className="text-sky-300">?distCode=412</code></span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 font-bold font-mono rounded text-[11px]">GET</span>
                      <code className="text-white font-mono font-semibold">/api/v1/epos/fps</code>
                    </div>
                    <span className="text-slate-400 text-[11px]">Query params: <code className="text-sky-300">?distCode=412&blockCode=412001</code></span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 font-bold font-mono rounded text-[11px]">GET</span>
                      <code className="text-white font-mono font-semibold">/api/v1/epos/fps/:fpsId/cards</code>
                    </div>
                    <span className="text-slate-400 text-[11px]">Fetch all resident RC numbers for this FPS</span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 font-bold font-mono rounded text-[11px]">POST</span>
                      <code className="text-white font-mono font-semibold">/api/v1/extract</code>
                    </div>
                    <span className="text-slate-400 text-[11px]">Body JSON: <code className="text-emerald-300">{`{ "rcNo": "..." }`}</code></span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>Server Proxy Port: 3000 (HTTPS TLS Allowed)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
