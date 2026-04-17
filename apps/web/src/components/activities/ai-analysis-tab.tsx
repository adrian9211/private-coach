'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface AIAnalysisTabProps {
  activityId: string
  activity: any
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export function AIAnalysisTab({ activityId, activity }: AIAnalysisTabProps) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load existing chat history when chat opens
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('activity_chat_messages')
          .select('role, content, created_at')
          .eq('activity_id', activityId)
          .order('created_at', { ascending: true })

        if (!error && Array.isArray(data)) {
          const msgs = data.map((m: any) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content as string,
            timestamp: new Date(m.created_at)
          })) as ChatMessage[]
          setChatMessages(msgs)
        }
      } catch (e) {
        console.warn('Failed to load chat history', e)
      }
    }
    if (showChat) {
      loadChatHistory()
    }
  }, [showChat, activityId])

  useEffect(() => {
    // Try to load existing analysis
    loadExistingAnalysis()
  }, [activityId])

  const loadExistingAnalysis = async (): Promise<string | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('activity_analyses')
        .select('summary, created_at')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      if (data?.summary) {
        setAnalysis(data.summary)
        return data.summary
      }
      return null
    } catch (err: any) {
      console.error('Error loading analysis:', err)
      return null
    }
  }

  const generateAnalysis = async () => {
    setIsGenerating(true)
    setLoading(true)
    setError(null)
    // Clear existing analysis immediately when regenerating
    setAnalysis(null)

    try {
      // Delete existing analysis first to ensure fresh generation
      try {
        await supabase
          .from('activity_analyses')
          .delete()
          .eq('activity_id', activityId)
      } catch (deleteError) {
        // Ignore delete errors - it's okay if no analysis exists
        console.log('No existing analysis to delete or delete failed:', deleteError)
      }

      const { data, error: invokeError } = await supabase.functions.invoke('generate-analysis', {
        body: { activityId, forceRegenerate: true },
      })

      if (invokeError) {
        console.error('Function invoke error:', invokeError)
        // Check for non-2xx status code
        if (invokeError.message?.includes('non-2xx status code')) {
          throw new Error('Edge Function Error: The function crashed or returned an error. This is usually due to a missing GOOGLE_API_KEY in Supabase secrets. Please check the Edge Function logs in the Supabase Dashboard.')
        }
        throw new Error(invokeError.message || 'Failed to invoke analysis function')
      }

      if (!data) {
        throw new Error('No response from analysis function')
      }

      // Check for error in response
      if (data.error) {
        console.error('Function returned error:', data)
        throw new Error(data.message || data.error || 'Failed to generate analysis')
      }

      // Use the response directly from the function (it's always fresh)
      if (data?.analysis?.summary) {
        setAnalysis(data.analysis.summary)
      } else if (data?.summary) {
        setAnalysis(data.summary)
      } else {
        // Fallback: try loading from database after a short delay
        await new Promise(resolve => setTimeout(resolve, 1500))
        const loadedAnalysis = await loadExistingAnalysis()
        if (loadedAnalysis) {
          setAnalysis(loadedAnalysis)
        } else {
          throw new Error('Analysis was generated but could not be retrieved. Please refresh the page.')
        }
      }
    } catch (err: any) {
      console.error('Error generating analysis:', err)
      let errorMessage = 'Failed to generate AI analysis. Please try again.'

      if (err.message) {
        errorMessage = err.message
      } else if (err.error) {
        errorMessage = err.error
      }

      // Add helpful hints
      if (errorMessage.includes('GOOGLE_API_KEY')) {
        errorMessage += '\n\nPlease ensure GOOGLE_API_KEY is set in Supabase Edge Function secrets.'
      } else if (errorMessage.includes('Gemini')) {
        errorMessage += '\n\nPlease check your Gemini API key and quota.'
      }

      setError(errorMessage)
    } finally {
      setIsGenerating(false)
      setLoading(false)
    }
  }

  const isIndoorActivity = activity?.data?.summary?.avgPower && activity.data.summary.avgPower > 0

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    if (!chatInput.trim() || sendingMessage) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setSendingMessage(true)
    setError(null)

    // Add user message to chat
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }
    setChatMessages(prev => [...prev, newUserMessage])

    try {
      // Prepare conversation history (last 10 messages)
      const history = chatMessages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const { data, error: invokeError } = await supabase.functions.invoke('ai-coach-chat', {
        body: {
          activityId,
          message: userMessage,
          conversationHistory: history
        },
      })

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to send message')
      }

      if (data?.error) {
        throw new Error(data.message || data.error || 'Failed to get response')
      }

      if (data?.response) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error('No response from AI coach')
      }
    } catch (err: any) {
      console.error('Error sending message:', err)
      setError(err.message || 'Failed to send message. Please try again.')
      // Remove the user message if sending failed
      setChatMessages(prev => prev.slice(0, -1))
    } finally {
      setSendingMessage(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-900">AI Coach Analysis</h3>
          {!analysis && (
            <button
              onClick={generateAnalysis}
              disabled={isGenerating || loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isGenerating ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Analyzing...
                </span>
              ) : (
                'Generate Analysis'
              )}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Get critical coaching feedback and time-optimized training recommendations
          {isIndoorActivity ? ' (Indoor with Power Meter)' : ' (Outdoor Activity)'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={generateAnalysis}
            className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium underline"
          >
            Try again
          </button>
        </div>
      )}

      {loading && !analysis && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Generating AI analysis...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
          </div>
        </div>
      )}

      {analysis && (() => {
          // Line-by-line markdown renderer
          const renderInline = (text: string): React.ReactNode[] => {
            const result: React.ReactNode[] = []
            const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
            let lastIndex = 0
            let match: RegExpExecArray | null
            let key = 0
            while ((match = pattern.exec(text)) !== null) {
              if (match.index > lastIndex) result.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>)
              if (match[2] !== undefined) result.push(<strong key={key++} className="font-semibold text-gray-900">{match[2]}</strong>)
              else if (match[3] !== undefined) result.push(<code key={key++} className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-sm font-mono">{match[3]}</code>)
              lastIndex = pattern.lastIndex
            }
            if (lastIndex < text.length) result.push(<span key={key++}>{text.slice(lastIndex)}</span>)
            return result
          }

          const lines = analysis.split('\n')
          const elements: React.JSX.Element[] = []
          let listItems: string[] = []
          let elKey = 0

          const flushList = () => {
            if (listItems.length === 0) return
            elements.push(
              <ul key={elKey++} className="space-y-1.5 mb-3 ml-1">
                {listItems.map((item, i) => (
                  <li key={i} className="flex gap-2 text-gray-700">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 mt-[0.55rem]" />
                    <span className="leading-relaxed">{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            )
            listItems = []
          }

          for (const raw of lines) {
            const line = raw.trimEnd()

            if (/^##\s+/.test(line) && !/^###/.test(line)) {
              flushList()
              const heading = line.replace(/^##\s+/, '').replace(/[📊📈🎯]/g, '').trim()
              elements.push(
                <h3 key={elKey++} className="text-base font-semibold text-gray-900 mt-5 mb-2 pt-4 border-t border-blue-100 first:border-0 first:pt-0 first:mt-0">
                  {heading}
                </h3>
              )
              continue
            }

            if (/^###\s+/.test(line)) {
              flushList()
              const heading = line.replace(/^###\s+/, '')
              elements.push(
                <h4 key={elKey++} className="text-sm font-semibold text-blue-700 mt-3 mb-1.5 uppercase tracking-wide">
                  {heading}
                </h4>
              )
              continue
            }

            if (/^[-*•]\s+/.test(line)) {
              listItems.push(line.replace(/^[-*•]\s+/, ''))
              continue
            }

            if (/^-{3,}$/.test(line.trim())) {
              flushList()
              elements.push(<hr key={elKey++} className="my-4 border-blue-100" />)
              continue
            }

            if (line.trim() === '') {
              flushList()
              continue
            }

            flushList()
            elements.push(
              <p key={elKey++} className="text-gray-700 leading-relaxed mb-2">
                {renderInline(line.trim())}
              </p>
            )
          }

          flushList()

          return (
            <div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 sm:p-6 border border-blue-200">
                <div className="space-y-0">{elements}</div>
              </div>

              <div className="mt-4 flex gap-3 flex-wrap">
                <button
                  onClick={generateAnalysis}
                  disabled={isGenerating}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
                >
                  {isGenerating ? 'Regenerating...' : '↻ Regenerate Analysis'}
                </button>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  {showChat ? '✕ Close Chat' : '💬 Ask Follow-up Question'}
                </button>
              </div>
            </div>
          )
        })()}

      {/* Follow-up Chat Interface */}
      {showChat && analysis && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Ask AI Coach</h4>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4" style={{ maxHeight: '500px', display: 'flex', flexDirection: 'column' }}>
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-3 max-h-96">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-sm">Start a conversation with your AI coach</p>
                  <p className="text-xs mt-2">Ask questions about your activity, training, or get clarification on the analysis</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-800 border border-gray-200'
                        }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {sendingMessage && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-lg px-4 py-2 border border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-gray-600">AI Coach is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a follow-up question..."
                className="flex-1 border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sendingMessage}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || sendingMessage}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {!analysis && !loading && !error && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">No Analysis Yet</h4>
          <p className="text-gray-600 mb-4 max-w-md mx-auto">
            Get personalized coaching feedback and time-optimized training recommendations based on your activity data.
          </p>
          <button
            onClick={generateAnalysis}
            disabled={isGenerating}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {isGenerating ? 'Analyzing...' : 'Generate AI Analysis'}
          </button>
        </div>
      )}
    </div>
  )
}

