import React, { useState, useEffect, useRef } from 'react';
import type { SearchResultDTO } from '@sideband/contracts';
import api from '../../hooks/useApi';
import Dialog from '../../components/ui/Dialog';
import Spinner from '../../components/ui/Spinner';

export interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  onSelectResult: (channelId: string, messageId: string) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  isOpen,
  onClose,
  spaceId,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultDTO[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await api.get<SearchResultDTO[]>(
          `/api/v1/search?q=${encodeURIComponent(trimmed)}&spaceId=${spaceId}`
        );
        setResults(Array.isArray(data) ? data : []);
        setHasSearched(true);
      } catch (err) {
        console.warn('Search query failed:', err);
        setResults([]);
        setHasSearched(true);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, spaceId]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Search Messages"
      description="Search across all accessible public and joined private channels."
      maxWidth={520}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Search input bar */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type words, phrases, or code snippets..."
            aria-label="Search messages in space"
            autoFocus
            style={{
              width: '100%',
              height: '40px',
              padding: '0 36px 0 12px',
              backgroundColor: 'var(--surface-0, #101416)',
              border: '1px solid var(--stroke, #303B3E)',
              borderRadius: 'var(--radius-md, 6px)',
              color: 'var(--type, #E9ECE7)',
              fontSize: '14px',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--type-faint, #74827E)',
            }}
          >
            {isSearching ? (
              <Spinner size={16} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            )}
          </div>
        </div>

        {/* Results / Status container */}
        <div
          style={{
            maxHeight: '380px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {!hasSearched && query.trim().length === 0 && (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--type-faint, #74827E)',
                fontSize: '13px',
              }}
            >
              Enter keywords to search message archives in this workspace.
            </div>
          )}

          {hasSearched && results.length === 0 && !isSearching && (
            <div
              style={{
                padding: '36px 16px',
                textAlign: 'center',
                backgroundColor: 'var(--surface-0, #101416)',
                border: '1px solid var(--stroke, #303B3E)',
                borderRadius: 'var(--radius-md, 6px)',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--type, #E9ECE7)',
                  marginBottom: '4px',
                }}
              >
                No messages found
              </div>
              <div style={{ fontSize: '12px', color: 'var(--type-muted, #9FAAA6)' }}>
                No messages in this workspace match &ldquo;{query}&rdquo;.
              </div>
            </div>
          )}

          {results.map((result) => (
            <div
              key={result.messageId}
              onClick={() => {
                onSelectResult(result.channelId, result.messageId);
                onClose();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectResult(result.channelId, result.messageId);
                  onClose();
                }
              }}
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--surface-0, #101416)',
                border: '1px solid var(--stroke, #303B3E)',
                borderRadius: 'var(--radius-md, 6px)',
                cursor: 'pointer',
                transition: 'border-color 140ms ease, background-color 140ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--signal, #A0BF9F)';
                e.currentTarget.style.backgroundColor = 'var(--surface-2, #1B2224)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--stroke, #303B3E)';
                e.currentTarget.style.backgroundColor = 'var(--surface-0, #101416)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--signal, #A0BF9F)',
                      fontWeight: 600,
                    }}
                  >
                    #{result.channelName}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--type, #E9ECE7)' }}>
                    {result.authorDisplayName}
                  </span>
                </div>

                <span style={{ fontSize: '11px', color: 'var(--type-faint, #74827E)' }}>
                  {new Date(result.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div
                style={{
                  fontSize: '13px',
                  lineHeight: 1.45,
                  color: 'var(--type-muted, #9FAAA6)',
                  wordBreak: 'break-word',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {result.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
};

export default SearchPanel;
