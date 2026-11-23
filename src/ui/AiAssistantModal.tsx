/**
 * @file AiAssistantModal.tsx
 * @description نافذة المساعد الهندسي الذكي وفحص المخططات (Engineering AI Assistant & Inspector) - المرحلة 7.
 * تدمج الفحص الآلي وفق كود البناء السعودي (SBC) والمعايير العالمية (NEC, ASHRAE, NFPA)
 * مع استشارات وتوصيات المساعد الذكي المولد عبر Gemini API.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Bot,
  Sparkles,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Info,
  Send,
  Zap,
  Wind,
  Flame,
  Building,
  Target,
  Copy,
  Check,
  RefreshCw,
  Server,
  Cpu,
} from 'lucide-react';
import { getLang } from '../i18n/index.ts';
import { ProjectModel } from '../model/project.ts';
import {
  runEngineeringAudit,
  AuditSummary,
  requestAiEngineeringAdviceDetailed,
  getAiServerConfig,
  setAiServerConfig,
  checkAiServer,
  type AiServerStatus,
  type AiAdviceSource,
  type AiFallbackReason,
} from '../engine/aiInspector.ts';

/** سبب اللجوء للتحليل المحلي بكلمات المستخدم */
const REASON_TEXT: Record<AiFallbackReason, string> = {
  NO_SERVER: 'لم يُضبط عنوان الخادم',
  UNREACHABLE: 'تعذر الوصول إلى الخادم',
  NO_API_KEY: 'المفتاح غير مضبوط على الخادم',
  BAD_TOKEN: 'رمز الوصول غير صحيح',
  RATE_LIMIT: 'تجاوزت حد الطلبات مؤقتاً',
  MODEL_ERROR: 'خطأ من خدمة الذكاء الاصطناعي',
  EMPTY: 'رد فارغ من الخدمة',
  TIMEOUT: 'انتهت مهلة الاتصال',
};

interface AiAssistantModalProps {
  model: ProjectModel;
  isOpen: boolean;
  onClose: () => void;
  onSelectObject?: (objectId: string) => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  model,
  isOpen,
  onClose,
  onSelectObject,
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'chat'>('audit');
  const [audit, setAudit] = useState<AuditSummary>(() => runEngineeringAudit(model));
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'error' | 'warning' | 'success'>('all');

  // شات المساعد الذكي
  const [messages, setMessages] = useState<
    { sender: 'user' | 'assistant'; text: string; timestamp: number; source?: AiAdviceSource; reason?: AiFallbackReason; model?: string }[]
  >([]);
  // إعداد خادم المساعد (مفتاح Gemini على الخادم فقط؛ هنا العنوان ورمز وصول اختياري)
  const [serverCfg, setServerCfg] = useState(() => getAiServerConfig());
  const [serverStatus, setServerStatus] = useState<AiServerStatus | null>(null);
  const [showServerCfg, setShowServerCfg] = useState(false);
  const refreshServerStatus = (cfg = getAiServerConfig()) => {
    setServerStatus(null);
    checkAiServer(cfg).then(setServerStatus);
  };
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // تحديث نتائج الفحص عند فتح النافذة
  useEffect(() => {
    if (isOpen) refreshServerStatus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const newAudit = runEngineeringAudit(model);
      setAudit(newAudit);

      // رسالة ترحيبية أولية من المساعد
      if (messages.length === 0) {
        setMessages([
          {
            sender: 'assistant',
            text: `مرحباً بك! أنا مساعدك الهندسي الذكي. قمت بفحص مخطط "${model.getMeta().name}" بمؤشر جودة **${newAudit.overallScore}/100**. يمكنك الضغط على أحد أزرار التحليل السريع أو طرح أي استفسار حول كود البناء والأحمال والتكييف ومكافحة الحريق.`,
            timestamp: Date.now(),
          },
        ]);
      }
    }
  }, [isOpen, model]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleRefreshAudit = () => {
    const updated = runEngineeringAudit(model);
    setAudit(updated);
  };

  const handleSendMessage = async (promptText?: string) => {
    const query = (promptText || inputPrompt).trim();
    if (!query || isLoading) return;

    const userMsg = { sender: 'user' as const, text: query, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const r = await requestAiEngineeringAdviceDetailed(model, query, audit, { lang: getLang() });
      setMessages((prev) => [
        ...prev,
        { sender: 'assistant', text: r.text, timestamp: Date.now(), source: r.source, reason: r.reason, model: r.model },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'عذراً، حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const filteredIssues = audit.issues.filter((issue) => {
    if (selectedSeverity === 'all') return true;
    return issue.severity === selectedSeverity;
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-950/60 border-emerald-500/50';
    if (score >= 60) return 'text-amber-400 bg-amber-950/60 border-amber-500/50';
    return 'text-rose-400 bg-rose-950/60 border-rose-500/50';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none p-4">
      <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh]">
        {/* رأس النافذة مع بطاقة التقييم الهندسي */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Bot size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>المساعد الهندسي الذكي (Engineering AI Assistant)</span>
                <span className="text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-2 py-0.5 rounded-full font-mono-cad">
                  مستشار SBC
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                تدقيق آلي متوافق مع كود البناء السعودي (SBC) واستشارات ذكية للأحمال والتنفيذ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* مؤشر الجودة الهندسية */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${getScoreColor(
                audit.overallScore
              )}`}
              title="مؤشر الجودة والتوافق الهندسي العام من 100"
            >
              <span>مؤشر المخطط:</span>
              <span className="font-mono-cad text-sm">{audit.overallScore}%</span>
            </div>

            <button
              onClick={handleRefreshAudit}
              className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
              title="إعادة فحص وتحديث النتائج"
            >
              <RefreshCw size={16} />
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* شريط الإحصائيات السريعة */}
        <div className="px-6 py-2.5 bg-neutral-950/40 border-b border-neutral-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-2 text-neutral-300">
            <Building size={14} className="text-sky-400 shrink-0" />
            <span>المساحة: <strong className="font-mono-cad text-white">{audit.metrics.roomMetrics.totalAreaSqM} م²</strong></span>
          </div>
          <div className="flex items-center gap-2 text-neutral-300">
            <Zap size={14} className="text-amber-400 shrink-0" />
            <span>الحمل: <strong className="font-mono-cad text-white">{audit.metrics.electricalMetrics.estimatedWatts}W</strong> ({audit.metrics.electricalMetrics.estimatedAmps}A)</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-300">
            <Wind size={14} className="text-emerald-400 shrink-0" />
            <span>التكييف: <strong className="font-mono-cad text-white">{audit.metrics.hvacMetrics.coolingCapacityTons} طن</strong></span>
          </div>
          <div className="flex items-center gap-2 text-neutral-300">
            <Flame size={14} className="text-rose-400 shrink-0" />
            <span>الإطفاء: <strong className="font-mono-cad text-white">{audit.metrics.fireMetrics.sprinklerCount} رشاش</strong></span>
          </div>
        </div>

        {/* التبويبات */}
        <div className="px-6 pt-3 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('audit')}
              className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
                activeTab === 'audit'
                  ? 'text-sky-400 border-sky-500'
                  : 'text-neutral-400 border-transparent hover:text-neutral-200'
              }`}
            >
              <AlertTriangle size={15} />
              <span>فحص وتدقيق المخطط ({audit.issues.length})</span>
            </button>

            <button
              data-testid="ai-tab-chat"
              onClick={() => setActiveTab('chat')}
              className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
                activeTab === 'chat'
                  ? 'text-purple-400 border-purple-500'
                  : 'text-neutral-400 border-transparent hover:text-neutral-200'
              }`}
            >
              <Sparkles size={15} />
              <span>المستشار الذكي (AI Advisor)</span>
            </button>
          </div>

          {activeTab === 'audit' && (
            <div className="flex items-center gap-1.5 pb-2">
              <button
                onClick={() => setSelectedSeverity('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  selectedSeverity === 'all'
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-400 hover:bg-neutral-800'
                }`}
              >
                الكل ({audit.issues.length})
              </button>
              {audit.errorCount > 0 && (
                <button
                  onClick={() => setSelectedSeverity('error')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                    selectedSeverity === 'error'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'text-rose-400 hover:bg-rose-950/40'
                  }`}
                >
                  <AlertOctagon size={11} />
                  <span>أخطاء ({audit.errorCount})</span>
                </button>
              )}
              {audit.warningCount > 0 && (
                <button
                  onClick={() => setSelectedSeverity('warning')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                    selectedSeverity === 'warning'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'text-amber-400 hover:bg-amber-950/40'
                  }`}
                >
                  <AlertTriangle size={11} />
                  <span>تنبيهات ({audit.warningCount})</span>
                </button>
              )}
              {audit.passedCount > 0 && (
                <button
                  onClick={() => setSelectedSeverity('success')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                    selectedSeverity === 'success'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'text-emerald-400 hover:bg-emerald-950/40'
                  }`}
                >
                  <CheckCircle2 size={11} />
                  <span>مطابق ({audit.passedCount})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* محتوى التبويبات */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'audit' ? (
            <div className="space-y-3">
              {filteredIssues.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 text-xs">
                  لا توجد ملاحظات في هذا التصنيف.
                </div>
              ) : (
                filteredIssues.map((issue) => {
                  const isError = issue.severity === 'error';
                  const isWarning = issue.severity === 'warning';
                  const isSuccess = issue.severity === 'success';

                  return (
                    <div
                      key={issue.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isError
                          ? 'bg-rose-950/20 border-rose-900/60'
                          : isWarning
                          ? 'bg-amber-950/20 border-amber-900/60'
                          : isSuccess
                          ? 'bg-emerald-950/20 border-emerald-900/60'
                          : 'bg-neutral-950/40 border-neutral-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {isError && <AlertOctagon size={18} className="text-rose-400" />}
                            {isWarning && <AlertTriangle size={18} className="text-amber-400" />}
                            {isSuccess && <CheckCircle2 size={18} className="text-emerald-400" />}
                            {!isError && !isWarning && !isSuccess && (
                              <Info size={18} className="text-sky-400" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-xs text-white">{issue.title}</h4>
                              {issue.codeReference && (
                                <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-mono-cad border border-neutral-700">
                                  {issue.codeReference}
                                </span>
                              )}
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold bg-neutral-900 text-neutral-400">
                                {issue.category}
                              </span>
                            </div>

                            <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
                              {issue.message}
                            </p>

                            <div className="mt-2 text-xs text-neutral-400 bg-neutral-950/50 p-2 rounded-lg border border-neutral-800/80">
                              <strong className="text-neutral-200">التوصية الهندسية: </strong>
                              <span>{issue.recommendation}</span>
                            </div>
                          </div>
                        </div>

                        {issue.relatedObjectId && onSelectObject && (
                          <button
                            onClick={() => {
                              onSelectObject(issue.relatedObjectId!);
                              onClose();
                            }}
                            className="shrink-0 text-[11px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-950/50 hover:bg-sky-900/50 border border-sky-800/60 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <Target size={13} />
                            <span>تحديد العنصر</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* تبويب الشات والمستشار الذكي */
            <div className="flex flex-col h-[52vh]">
              {/* حالة خادم المساعد وإعداده */}
              <div className="mb-2 shrink-0 rounded-xl border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-[11px]" data-testid="ai-server-panel">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5" data-testid="ai-server-status">
                    <Server size={13} className="text-neutral-400" />
                    {serverStatus === null ? (
                      <span className="text-neutral-400">جارٍ فحص الخادم…</span>
                    ) : serverStatus.reachable && serverStatus.available && serverStatus.authorized !== false ? (
                      <span className="text-emerald-400">
                        متصل بالخادم — <span data-no-i18n>{serverStatus.model}</span>
                      </span>
                    ) : serverStatus.reachable && serverStatus.authorized === false ? (
                      <span className="text-amber-400">الخادم يتطلب رمز وصول صحيحاً</span>
                    ) : serverStatus.reachable ? (
                      <span className="text-amber-400">الخادم متاح لكن مفتاح الذكاء الاصطناعي غير مضبوط عليه</span>
                    ) : (
                      <span className="text-neutral-400">وضع التحليل المحلي (دون خادم)</span>
                    )}
                  </div>
                  <button onClick={() => setShowServerCfg((v) => !v)} className="text-sky-400 hover:text-sky-300" data-testid="ai-server-toggle">
                    إعداد الخادم
                  </button>
                </div>
                {showServerCfg && (
                  <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <label className="flex flex-col gap-1">
                      <span className="text-neutral-400">عنوان الخادم (فارغ = نفس الموقع)</span>
                      <input
                        dir="ltr"
                        value={serverCfg.url}
                        onChange={(e) => setServerCfg({ ...serverCfg, url: e.target.value })}
                        placeholder="https://cad.example.com"
                        className="bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-xs font-mono outline-none focus:border-sky-500"
                        data-testid="ai-server-url"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-neutral-400">رمز الوصول (اختياري — ليس مفتاح Gemini)</span>
                      <input
                        dir="ltr"
                        type="password"
                        value={serverCfg.token}
                        onChange={(e) => setServerCfg({ ...serverCfg, token: e.target.value })}
                        className="bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-xs font-mono outline-none focus:border-sky-500"
                        data-testid="ai-server-token"
                      />
                    </label>
                    <button
                      onClick={() => {
                        setAiServerConfig(serverCfg);
                        refreshServerStatus(serverCfg);
                      }}
                      className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-bold"
                      data-testid="ai-server-save"
                    >
                      حفظ وفحص
                    </button>
                    <p className="col-span-3 text-[10px] leading-5 text-neutral-500">
                      مفتاح الذكاء الاصطناعي يبقى على الخادم في متغير البيئة GEMINI_API_KEY ولا يُحفظ في التطبيق. دون خادم يعمل المساعد بالتحليل الهندسي المحلي.
                    </p>
                  </div>
                )}
              </div>
              {/* أزرار التحليل السريع */}
              <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-2 border-b border-neutral-800 shrink-0">
                <span className="text-[11px] text-neutral-400 shrink-0">تحليل سريع:</span>
                <button
                  onClick={() => handleSendMessage('تدقيق كود الكهرباء والأحمال وفق كود SBC 401')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-xs border border-neutral-700 whitespace-nowrap transition-colors flex items-center gap-1"
                >
                  <Zap size={12} className="text-amber-400" />
                  <span>الأحمال الكهربائية</span>
                </button>
                <button
                  onClick={() => handleSendMessage('حساب أحمال التكييف وتوزيع الدكت والتبريد')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-emerald-300 text-xs border border-neutral-700 whitespace-nowrap transition-colors flex items-center gap-1"
                >
                  <Wind size={12} className="text-emerald-400" />
                  <span>التكييف والتهوية</span>
                </button>
                <button
                  onClick={() => handleSendMessage('فحص شبكة إطفاء الحريق ومعايير السلامة NFPA')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-rose-300 text-xs border border-neutral-700 whitespace-nowrap transition-colors flex items-center gap-1"
                >
                  <Flame size={12} className="text-rose-400" />
                  <span>مكافحة الحريق</span>
                </button>
                <button
                  onClick={() => handleSendMessage('قدم تقرير اعتماد هندسي شامل للمشروع')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sky-300 text-xs border border-neutral-700 whitespace-nowrap transition-colors flex items-center gap-1"
                >
                  <Sparkles size={12} className="text-sky-400" />
                  <span>تقرير شامل</span>
                </button>
              </div>

              {/* سجل الرسائل */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-sky-600 text-white rounded-br-xs'
                          : 'bg-neutral-950/70 text-neutral-200 border border-neutral-800 rounded-bl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans" data-no-i18n={msg.sender === 'assistant' && idx > 0 ? '' : undefined}>
                        {msg.text}
                      </div>

                      {msg.sender === 'assistant' && (
                        <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400">
                          <span className="flex items-center gap-1" data-testid={msg.source ? `ai-source-${msg.source}` : undefined}>
                            {msg.source === 'server' ? (
                              <>
                                <Server size={11} className="text-emerald-400" />
                                <span>عبر الخادم</span>
                                {msg.model && <span data-no-i18n>· {msg.model}</span>}
                              </>
                            ) : msg.source === 'offline' ? (
                              <>
                                <Cpu size={11} className="text-amber-400" />
                                <span>تحليل محلي</span>
                                {msg.reason && <span>· {REASON_TEXT[msg.reason]}</span>}
                              </>
                            ) : (
                              <span>المساعد الهندسي الذكي</span>
                            )}
                          </span>
                          <button
                            onClick={() => handleCopy(msg.text, idx)}
                            className="flex items-center gap-1 hover:text-white transition-colors"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check size={12} className="text-emerald-400" />
                                <span className="text-emerald-400">تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>نسخ التقرير</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-sky-400 bg-sky-950/40 p-3 rounded-xl border border-sky-800/50 w-fit">
                    <Sparkles size={14} className="animate-spin" />
                    <span>جاري تحليل المخطط وتوليد التوصيات الهندسية...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* حقل إدخال الرسالة */}
              <div className="pt-3 border-t border-neutral-800 mt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="اسأل المساعد الهندسي (مثال: ما هو القاطع المناسب لمكيف 2 طن؟)"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputPrompt.trim() || isLoading}
                  className={`p-2.5 rounded-xl transition-all ${
                    inputPrompt.trim() && !isLoading
                      ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shadow-md shadow-sky-600/30'
                      : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                  }`}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* تذييل النافذة */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between text-xs text-neutral-400">
          <span>
            يستند التحليل إلى كود البناء السعودي (SBC) والأكواد العالمية (NEC, ASHRAE, NFPA)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
