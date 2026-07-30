import { useEffect, useMemo, useRef, useState } from 'react'
import { useConversationMessages, useConversations } from 'lemma-sdk/react'
import { ArrowUp, History as HistoryIcon, SquarePen, X } from 'lucide-react'
import { AnswerEvidence } from './AnswerEvidence'
import { ChuckPet } from './ChuckPet'
import { lemmaClient } from './lemma-client'
import {
  displayCitationQuestion,
  parseAgentAnswer,
  prepareCitationQuestion,
  type NoteEvidence,
} from './app-contract'
import { looksLikeQuestion, Rec, timeAgo } from './lib'
import { mdToHtml } from './markdown'

type ChatMessage = {
  id: string
  role: 'user' | 'chuck'
  text: string
  evidence?: NoteEvidence[]
}

function conversationTitle(title?: string | null) {
  return displayCitationQuestion(title) || 'Untitled conversation'
}

function newConversationTitle(message: string) {
  const clean = displayCitationQuestion(message).replace(/\s+/g, ' ').trim()
  return clean.length > 64 ? `${clean.slice(0, 63).trimEnd()}…` : clean
}

export function Chat({ notes, onOpenNote }: { notes: Rec[]; onOpenNote: (noteId: string) => void }) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [pendingUser, setPendingUser] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sendError, setSendError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const choseInitialConversation = useRef(false)

  const history = useConversations({
    client: lemmaClient,
    agentName: 'chuck',
    autoSelectFirst: false,
    limit: 20,
  })
  const activeConversationId = history.selectedConversationId
  const thread = useConversationMessages({
    client: lemmaClient,
    agentName: 'chuck',
    conversationId: activeConversationId,
    autoResume: true,
    limit: 100,
    syncOnTurnEnd: true,
  })

  // Start on the most recently used saved conversation, but preserve an explicit
  // "New chat" selection for the rest of this mount.
  useEffect(() => {
    if (choseInitialConversation.current || !history.conversations.length) return
    choseInitialConversation.current = true
    history.selectConversation(history.conversations[0].id)
  }, [history.conversations, history.selectConversation])

  useEffect(() => {
    if (!historyOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHistoryOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [historyOpen])

  const messages = useMemo<ChatMessage[]>(() => {
    return thread.messages.flatMap((message): ChatMessage[] => {
      const role = message.role.toLowerCase()
      if (message.kind !== 'TEXT' || !message.text) return []

      if (role === 'user') {
        const displayText = typeof message.metadata?.display_text === 'string'
          ? message.metadata.display_text
          : displayCitationQuestion(message.text)
        return [{ id: message.id, role: 'user' as const, text: displayText }]
      }

      if (role !== 'assistant' || message.metadata?.is_final_answer !== true) return []
      const parsed = parseAgentAnswer(message.text)
      return [{
        id: message.id,
        role: 'chuck' as const,
        text: parsed.answer || '…',
        evidence: parsed.evidence,
      }]
    })
  }, [thread.messages])

  const streamingAnswer = useMemo(
    () => parseAgentAnswer(thread.streamingText || '').answer,
    [thread.streamingText],
  )
  const pendingAlreadyVisible = pendingUser
    ? messages.some((message) => message.role === 'user' && message.text === pendingUser)
    : false
  const isBusy = isSending || thread.isRunning
  const hasVisibleConversation = messages.length > 0 || !!pendingUser || isBusy

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pendingUser, streamingAnswer, isBusy])

  async function send() {
    const value = input.trim()
    if (!value || isBusy) return

    setInput('')
    setPendingUser(value)
    setSendError('')
    setIsSending(true)

    let conversationId = activeConversationId
    try {
      if (!conversationId) {
        const created = await history.createAndSelectConversation({
          title: newConversationTitle(value),
          metadata: { surface: 'chuck-app-chat' },
        })
        conversationId = created.id
        choseInitialConversation.current = true
      }

      await thread.sendMessage(
        looksLikeQuestion(value) ? prepareCitationQuestion(value) : value,
        {
          conversationId,
          metadata: { display_text: value, surface: 'chuck-app-chat' },
          syncOnTurnEnd: true,
        },
      )
      await history.refresh()
      history.selectConversation(conversationId)
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Chuck could not send that message.')
    } finally {
      setPendingUser(null)
      setIsSending(false)
    }
  }

  function startNewChat() {
    if (isBusy) return
    choseInitialConversation.current = true
    history.clearSelection()
    thread.clearMessages()
    setPendingUser(null)
    setSendError('')
    setInput('')
    setHistoryOpen(false)
  }

  function openConversation(conversationId: string) {
    if (isBusy || conversationId === activeConversationId) {
      setHistoryOpen(false)
      return
    }
    choseInitialConversation.current = true
    thread.clearMessages()
    history.selectConversation(conversationId)
    setSendError('')
    setHistoryOpen(false)
  }

  return (
    <div className="main">
      <div className="chat">
        <header className="chat-topbar ui">
          <div className="chat-title">
            <h1>Chat</h1>
            <p>{activeConversationId
              ? conversationTitle(history.selectedConversation?.title)
              : 'New conversation'}</p>
          </div>
          <div className="chat-top-actions">
            <button
              className="chat-top-button"
              type="button"
              aria-label="Open chat history"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen(true)}
            >
              <HistoryIcon size={16} />
              <span>History</span>
            </button>
            <button
              className="chat-top-button primary-action"
              type="button"
              disabled={isBusy}
              onClick={startNewChat}
            >
              <SquarePen size={16} />
              <span>New chat</span>
            </button>
          </div>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          <div className="chat-wrap">
            {thread.isLoading && activeConversationId && !messages.length ? (
              <div className="chat-empty ui">
                <ChuckPet state="review" size={72} className="chat-empty__pet" />
                Opening conversation…
              </div>
            ) : null}
            {!thread.isLoading && !hasVisibleConversation ? (
              <div className="chat-empty ui">
                <ChuckPet state="waving" size={88} className="chat-empty__pet" />
                <b>Talk to Chuck.</b><br />
                Paste a link, drop a thought, or ask what you've saved.
              </div>
            ) : null}

            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                notes={notes}
                onOpenNote={onOpenNote}
              />
            ))}

            {pendingUser && !pendingAlreadyVisible ? (
              <ChatBubble
                message={{ id: 'pending-user', role: 'user', text: pendingUser }}
                notes={notes}
                onOpenNote={onOpenNote}
              />
            ) : null}

            {isBusy ? (
              <div className="msg chuck">
                <div className="av pet"><ChuckPet state="review" size={38} /></div>
                {streamingAnswer
                  ? <div className="bubble md" dangerouslySetInnerHTML={{ __html: mdToHtml(streamingAnswer) }} />
                  : <div className="bubble pet-status-bubble ui">{thread.status || 'thinking…'}</div>}
              </div>
            ) : null}

            {sendError || thread.error ? (
              <div className="chat-inline-error ui" role="alert">
                {sendError || thread.error?.message}
              </div>
            ) : null}
          </div>
        </div>

        <div className="chat-compose">
          <div className="inner">
            <div className="chuck-in">
              <input
                value={input}
                aria-label="Message Chuck"
                placeholder="Message Chuck…"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void send() }}
              />
              <button
                className="send"
                type="button"
                aria-label="Send message"
                disabled={!input.trim() || isBusy}
                onClick={() => void send()}
              >
                <ArrowUp size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {historyOpen ? (
        <>
          <button
            className="chat-history-scrim"
            type="button"
            aria-label="Close chat history"
            onClick={() => setHistoryOpen(false)}
          />
          <aside className="chat-history-panel ui" role="dialog" aria-modal="true" aria-label="Chat history">
            <div className="chat-history-head">
              <div>
                <span>Chuck</span>
                <h2>Chat history</h2>
              </div>
              <button className="icon-ghost" type="button" aria-label="Close history" onClick={() => setHistoryOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <button className="chat-history-new" type="button" disabled={isBusy} onClick={startNewChat}>
              <SquarePen size={16} />
              Start a new chat
            </button>

            <div className="chat-history-list">
              {history.isLoading && !history.conversations.length ? (
                <div className="chat-history-empty">Loading saved conversations…</div>
              ) : null}
              {!history.isLoading && !history.conversations.length ? (
                <div className="chat-history-empty">
                  <ChuckPet state="idle" size={54} animate={false} />
                  <span>No saved chats yet.</span>
                </div>
              ) : null}
              {history.conversations.map((conversation) => (
                <button
                  className={`chat-history-item${conversation.id === activeConversationId ? ' on' : ''}`}
                  type="button"
                  key={conversation.id}
                  disabled={isBusy && conversation.id !== activeConversationId}
                  onClick={() => openConversation(conversation.id)}
                >
                  <span>{conversationTitle(conversation.title)}</span>
                  <small>{timeAgo(conversation.updated_at || conversation.created_at)}</small>
                </button>
              ))}
            </div>

            {history.nextPageToken ? (
              <button
                className="chat-history-load"
                type="button"
                disabled={history.isLoadingMore}
                onClick={() => void history.loadMore()}
              >
                {history.isLoadingMore ? 'Loading…' : 'Load older chats'}
              </button>
            ) : null}
            {history.error ? <div className="chat-history-error" role="alert">{history.error.message}</div> : null}
          </aside>
        </>
      ) : null}
    </div>
  )
}

function ChatBubble({
  message,
  notes,
  onOpenNote,
}: {
  message: ChatMessage
  notes: Rec[]
  onOpenNote: (noteId: string) => void
}) {
  return (
    <div className={`msg ${message.role}`}>
      <div className={`av${message.role === 'chuck' ? ' pet' : ''}`}>
        {message.role === 'user'
          ? 'You'
          : <ChuckPet state="idle" size={30} animate={false} />}
      </div>
      {message.role === 'chuck'
        ? (
          <div className="answer-stack">
            <div className="bubble md" dangerouslySetInnerHTML={{ __html: mdToHtml(message.text) }} />
            {message.evidence?.length
              ? <AnswerEvidence evidence={message.evidence} notes={notes} onOpenNote={onOpenNote} />
              : null}
          </div>
        )
        : <div className="bubble">{message.text}</div>}
    </div>
  )
}
