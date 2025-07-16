"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { Card } from './card';
import { ScrollArea } from './scroll-area';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, RefreshCcw } from 'lucide-react';
import { useAppTranslation } from '@/lib/i18n';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/lib/store';

interface TranslationHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TranslationEntry {
  type: string;
  name: string;
  status: string;
  keys: string;
}

interface TranslationSummary {
  lang: string;
  translations: TranslationEntry[];
}

interface SessionRowProps {
  sessionId: string;
  isExpanded: boolean;
  onToggle: () => void;
  minecraftDir: string;
}

function SessionRow({ sessionId, isExpanded, onToggle, minecraftDir }: SessionRowProps) {
  const { t } = useAppTranslation();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<TranslationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Format session ID to human-readable date/time
  const formatSessionId = (id: string) => {
    // Format: YYYY-MM-DD_HH-MM-SS
    const match = id.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
    if (match) {
      const [_, year, month, day, hour, minute, second] = match;
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
    return id;
  };

  const loadSummary = async () => {
    if (!isExpanded || summary) return;

    setLoading(true);
    setError(null);
    
    try {
      const result = await invoke<TranslationSummary>('get_translation_summary', {
        minecraftDir,
        sessionId
      });
      setSummary(result);
    } catch (err) {
      console.error('Failed to load translation summary:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [isExpanded]);

  return (
    <Card className="p-4">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-2">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{formatSessionId(sessionId)}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isExpanded ? t('common.hideDetails', 'Hide Details') : t('common.viewDetails', 'View Details')}
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-2">
          {loading && (
            <div className="text-sm text-muted-foreground">
              {t('common.loading', 'Loading...')}
            </div>
          )}
          
          {error && (
            <div className="text-sm text-red-500">
              {t('errors.failedToLoad', 'Failed to load details')}: {error}
            </div>
          )}
          
          {summary && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">{t('tables.targetLanguage', 'Target Language')}:</span> {summary.lang}
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium">{t('tables.translations', 'Translations')}:</div>
                {summary.translations.map((translation, index) => (
                  <div key={index} className="flex items-center justify-between text-sm pl-4">
                    <div className="flex items-center space-x-2">
                      {translation.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="capitalize">{translation.type}:</span>
                      <span>{translation.name}</span>
                    </div>
                    <span className="text-muted-foreground">({translation.keys})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function TranslationHistoryDialog({ open, onOpenChange }: TranslationHistoryDialogProps) {
  const { t } = useAppTranslation();
  const config = useAppStore(state => state.config);
  const [sessions, setSessions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const minecraftDir = config.paths.minecraftDir || '';
      const sessionList = await invoke<string[]>('list_translation_sessions', {
        minecraftDir
      });
      setSessions(sessionList);
    } catch (err) {
      console.error('Failed to load translation sessions:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [config.paths.minecraftDir]);

  useEffect(() => {
    if (open) {
      loadSessions();
    }
  }, [open, loadSessions]);

  const handleToggleSession = (sessionId: string) => {
    setExpandedSession(prev => prev === sessionId ? null : sessionId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t('backup.translationHistory', 'Translation History')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="text-center py-8">
              <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">{t('common.loading', 'Loading...')}</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500">
              <p>{t('errors.failedToLoad', 'Failed to load sessions')}</p>
              <p className="text-sm mt-2">{error}</p>
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('backup.noHistory', 'No translation history found')}</p>
            </div>
          )}

          {!loading && !error && sessions.length > 0 && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {sessions.map((sessionId) => (
                  <SessionRow
                    key={sessionId}
                    sessionId={sessionId}
                    isExpanded={expandedSession === sessionId}
                    onToggle={() => handleToggleSession(sessionId)}
                    minecraftDir={config.paths.minecraftDir || ''}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => loadSessions()}
            disabled={loading}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            {t('common.refresh', 'Refresh')}
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            {t('common.close', 'Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}