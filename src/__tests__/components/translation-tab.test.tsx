import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranslationTab, TranslationTabProps } from '@/components/tabs/common/translation-tab';
import { TranslationService } from '@/lib/services/translation-service';
import { FileService } from '@/lib/services/file-service';
import { AppConfig } from '@/lib/types/config';

// Mock dependencies
vi.mock('@/lib/services/file-service');
vi.mock('@/lib/services/translation-service');
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}));
vi.mock('@/lib/i18n', () => ({
    useAppTranslation: () => ({ t: (key: string) => key })
}));

describe('TranslationTab', () => {
    let defaultProps: TranslationTabProps;
    let mockOnScan: Mock;
    let mockOnTranslate: Mock;
    let mockSetTranslationTargets: Mock;
    let mockUpdateTranslationTarget: Mock;
    let mockSetTranslating: Mock;
    let mockSetProgress: Mock;
    let mockSetWholeProgress: Mock;
    let mockSetTotalChunks: Mock;
    let mockSetCompletedChunks: Mock;
    let mockAddTranslationResult: Mock;
    let mockSetError: Mock;
    let mockSetCurrentJobId: Mock;
    let mockSetCompletionDialogOpen: Mock;
    let mockSetLogDialogOpen: Mock;
    let mockResetTranslationState: Mock;
    let mockSetTranslationServiceRef: Mock;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock functions
        mockOnScan = vi.fn();
        mockOnTranslate = vi.fn();
        mockSetTranslationTargets = vi.fn();
        mockUpdateTranslationTarget = vi.fn();
        mockSetTranslating = vi.fn();
        mockSetProgress = vi.fn();
        mockSetWholeProgress = vi.fn();
        mockSetTotalChunks = vi.fn();
        mockSetCompletedChunks = vi.fn();
        mockAddTranslationResult = vi.fn();
        mockSetError = vi.fn();
        mockSetCurrentJobId = vi.fn();
        mockSetCompletionDialogOpen = vi.fn();
        mockSetLogDialogOpen = vi.fn();
        mockResetTranslationState = vi.fn();
        mockSetTranslationServiceRef = vi.fn();

        // Setup default props
        const mockConfig: AppConfig = {
            llm: {
                provider: 'openai',
                apiKey: 'test-key',
                model: 'gpt-4',
                baseUrl: 'https://api.openai.com',
                promptTemplate: 'default',
                maxRetries: 3
            },
            translation: {
                targetLanguage: 'ja_jp',
                additionalLanguages: [
                    { id: 'ja_jp', name: 'Japanese' },
                    { id: 'ko_kr', name: 'Korean' }
                ],
                modChunkSize: 50,
                questChunkSize: 30,
                guidebookChunkSize: 40,
                useTokenBasedChunking: false,
                maxTokensPerChunk: 1000,
                fallbackToEntryBased: true
            },
            paths: {
                minecraftDir: '/minecraft'
            }
        };

        defaultProps = {
            tabType: 'mods',
            setTranslationServiceRef: mockSetTranslationServiceRef,
            scanButtonLabel: 'buttons.scanMods',
            scanningLabel: 'buttons.scanning',
            progressLabel: 'progress.translatingMods',
            noItemsSelectedError: 'errors.noModsSelected',
            noItemsFoundLabel: 'tables.noModsFound',
            scanningForItemsLabel: 'tables.scanningForMods',
            directorySelectLabel: 'buttons.selectProfileDirectory',
            filterPlaceholder: 'filters.filterMods',
            tableColumns: [
                { key: 'name', label: 'tables.modName' },
                { key: 'id', label: 'tables.modId' },
                { key: 'version', label: 'tables.version' }
            ],
            config: mockConfig,
            translationTargets: [],
            setTranslationTargets: mockSetTranslationTargets,
            updateTranslationTarget: mockUpdateTranslationTarget,
            isTranslating: false,
            progress: 0,
            wholeProgress: 0,
            setTranslating: mockSetTranslating,
            setProgress: mockSetProgress,
            setWholeProgress: mockSetWholeProgress,
            setTotalChunks: mockSetTotalChunks,
            setCompletedChunks: mockSetCompletedChunks,
            addTranslationResult: mockAddTranslationResult,
            error: null,
            setError: mockSetError,
            currentJobId: null,
            setCurrentJobId: mockSetCurrentJobId,
            isCompletionDialogOpen: false,
            setCompletionDialogOpen: mockSetCompletionDialogOpen,
            setLogDialogOpen: mockSetLogDialogOpen,
            resetTranslationState: mockResetTranslationState,
            onScan: mockOnScan,
            onTranslate: mockOnTranslate
        };

        // Mock FileService
        (FileService.openDirectoryDialog as Mock).mockResolvedValue('NATIVE_DIALOG:/test/directory');
    });

    describe('Initial rendering', () => {
        it('should render all required buttons', () => {
            render(<TranslationTab {...defaultProps} />);

            expect(screen.getByText('buttons.selectProfileDirectory')).toBeInTheDocument();
            expect(screen.getByText('buttons.scanMods')).toBeInTheDocument();
            expect(screen.getByText('buttons.translate')).toBeInTheDocument();
        });

        it('should render table with correct columns', () => {
            render(<TranslationTab {...defaultProps} />);

            expect(screen.getByText('tables.modName')).toBeInTheDocument();
            expect(screen.getByText('tables.modId')).toBeInTheDocument();
            expect(screen.getByText('tables.version')).toBeInTheDocument();
        });

        it('should show empty state message', () => {
            render(<TranslationTab {...defaultProps} />);

            expect(screen.getByText('tables.noModsFound')).toBeInTheDocument();
        });

        it('should disable scan button when no directory selected', () => {
            render(<TranslationTab {...defaultProps} />);

            const scanButton = screen.getByText('buttons.scanMods');
            expect(scanButton).toBeDisabled();
        });

        it('should disable translate button when no targets', () => {
            render(<TranslationTab {...defaultProps} />);

            const translateButton = screen.getByText('buttons.translate');
            expect(translateButton).toBeDisabled();
        });
    });

    describe('Directory selection', () => {
        it('should handle directory selection', async () => {
            const user = userEvent.setup();
            render(<TranslationTab {...defaultProps} />);

            const selectButton = screen.getByText('buttons.selectProfileDirectory');
            await user.click(selectButton);

            expect(FileService.openDirectoryDialog).toHaveBeenCalledWith('buttons.selectProfileDirectory');
            
            await waitFor(() => {
                expect(screen.getByText('/test/directory')).toBeInTheDocument();
            });
        });

        it('should enable scan button after directory selection', async () => {
            const user = userEvent.setup();
            render(<TranslationTab {...defaultProps} />);

            const selectButton = screen.getByText('buttons.selectProfileDirectory');
            await user.click(selectButton);

            await waitFor(() => {
                const scanButton = screen.getByText('buttons.scanMods');
                expect(scanButton).not.toBeDisabled();
            });
        });

        it('should handle directory selection error', async () => {
            (FileService.openDirectoryDialog as Mock).mockRejectedValueOnce(new Error('Permission denied'));
            
            const user = userEvent.setup();
            render(<TranslationTab {...defaultProps} />);

            const selectButton = screen.getByText('buttons.selectProfileDirectory');
            await user.click(selectButton);

            await waitFor(() => {
                expect(mockSetError).toHaveBeenCalledWith('Failed to select directory: Error: Permission denied');
            });
        });
    });

    describe('Scanning functionality', () => {
        it('should handle scan process', async () => {
            const user = userEvent.setup();
            render(<TranslationTab {...defaultProps} />);

            // Select directory first
            const selectButton = screen.getByText('buttons.selectProfileDirectory');
            await user.click(selectButton);

            await waitFor(() => {
                const scanButton = screen.getByText('buttons.scanMods');
                expect(scanButton).not.toBeDisabled();
            });

            // Click scan
            const scanButton = screen.getByText('buttons.scanMods');
            await user.click(scanButton);

            expect(mockOnScan).toHaveBeenCalledWith('/test/directory');
        });

        it('should show scanning state', async () => {
            mockOnScan.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
            
            const user = userEvent.setup();
            render(<TranslationTab {...defaultProps} />);

            // Select directory first
            await user.click(screen.getByText('buttons.selectProfileDirectory'));
            
            await waitFor(() => {
                expect(screen.getByText('buttons.scanMods')).not.toBeDisabled();
            });

            // Click scan
            await user.click(screen.getByText('buttons.scanMods'));

            // Should show scanning label
            expect(screen.getByText('buttons.scanning')).toBeInTheDocument();
        });

        it('should display found targets', () => {
            const targets = [
                {
                    type: 'mod',
                    id: 'minecraft',
                    name: 'Minecraft',
                    version: '1.20.1',
                    path: '/mods/minecraft.jar',
                    relativePath: 'minecraft.jar',
                    selected: true
                },
                {
                    type: 'mod',
                    id: 'jei',
                    name: 'Just Enough Items',
                    version: '11.6.0',
                    path: '/mods/jei.jar',
                    relativePath: 'jei.jar',
                    selected: true
                }
            ];

            render(<TranslationTab {...defaultProps} translationTargets={targets} />);

            expect(screen.getByText('Minecraft')).toBeInTheDocument();
            expect(screen.getByText('Just Enough Items')).toBeInTheDocument();
        });
    });

    describe('Target selection', () => {
        it('should handle individual target selection', async () => {
            const user = userEvent.setup();
            const targets = [
                {
                    type: 'mod',
                    id: 'minecraft',
                    name: 'Minecraft',
                    version: '1.20.1',
                    path: '/mods/minecraft.jar',
                    relativePath: 'minecraft.jar',
                    selected: true
                }
            ];

            render(<TranslationTab {...defaultProps} translationTargets={targets} />);

            const checkbox = screen.getAllByRole('checkbox')[1]; // First is select all
            await user.click(checkbox);

            expect(mockUpdateTranslationTarget).toHaveBeenCalledWith('minecraft', false);
        });

        it('should handle select all functionality', async () => {
            const user = userEvent.setup();
            const targets = [
                {
                    type: 'mod',
                    id: 'minecraft',
                    name: 'Minecraft',
                    version: '1.20.1',
                    path: '/mods/minecraft.jar',
                    relativePath: 'minecraft.jar',
                    selected: false
                },
                {
                    type: 'mod',
                    id: 'jei',
                    name: 'Just Enough Items',
                    version: '11.6.0',
                    path: '/mods/jei.jar',
                    relativePath: 'jei.jar',
                    selected: false
                }
            ];

            render(<TranslationTab {...defaultProps} translationTargets={targets} />);

            const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
            await user.click(selectAllCheckbox);

            expect(mockSetTranslationTargets).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ id: 'minecraft', selected: true }),
                    expect.objectContaining({ id: 'jei', selected: true })
                ])
            );
        });
    });

    describe('Translation process', () => {
        beforeEach(() => {
            (FileService.openDirectoryDialog as Mock).mockResolvedValue('NATIVE_DIALOG:/test/directory');
            vi.mocked(TranslationService).mockImplementation(() => ({
                createJob: vi.fn(),
                startJob: vi.fn(),
                translateChunk: vi.fn(),
                isJobInterrupted: vi.fn(),
                interruptJob: vi.fn(),
                getJob: vi.fn(),
                getCombinedTranslatedContent: vi.fn(),
                clearJob: vi.fn(),
                clearAllJobs: vi.fn(),
                getAllJobs: vi.fn(),
                getApiCallCount: vi.fn()
            } as any));
        });

        it('should validate before starting translation', async () => {
            const user = userEvent.setup();
            render(<TranslationTab {...defaultProps} />);

            const translateButton = screen.getByText('buttons.translate');
            await user.click(translateButton);

            expect(mockSetError).toHaveBeenCalledWith('errors.noModsSelected');
            expect(mockOnTranslate).not.toHaveBeenCalled();
        });

        it('should validate target language selection', async () => {
            const user = userEvent.setup();
            const targets = [
                {
                    type: 'mod',
                    id: 'minecraft',
                    name: 'Minecraft',
                    version: '1.20.1',
                    path: '/mods/minecraft.jar',
                    relativePath: 'minecraft.jar',
                    selected: true
                }
            ];

            render(<TranslationTab {...defaultProps} translationTargets={targets} />);

            const translateButton = screen.getByText('buttons.translate');
            await user.click(translateButton);

            expect(mockSetError).toHaveBeenCalledWith('errors.noTargetLanguageSelected');
        });

        it('should start translation with valid inputs', async () => {
            const user = userEvent.setup();
            const targets = [
                {
                    type: 'mod',
                    id: 'minecraft',
                    name: 'Minecraft',
                    version: '1.20.1',
                    path: '/mods/minecraft.jar',
                    relativePath: 'minecraft.jar',
                    selected: true
                }
            ];

            // Mock invoke for log directory creation
            const { invoke } = await import('@tauri-apps/api/core');
            (invoke as Mock)
                .mockResolvedValueOnce(undefined) // clear_logs
                .mockResolvedValueOnce('session-123') // generate_session_id
                .mockResolvedValueOnce('/logs/session-123') // create_logs_directory_with_session
                .mockResolvedValueOnce('/temp/session-123'); // create_temp_directory_with_session

            render(<TranslationTab {...defaultProps} translationTargets={targets} />);

            // Select directory
            await user.click(screen.getByText('buttons.selectProfileDirectory'));

            // Select target language
            const languageSelector = screen.getByRole('combobox');
            await user.click(languageSelector);
            await user.click(screen.getByText('Japanese'));

            // Click translate
            const translateButton = screen.getByText('buttons.translate');
            await user.click(translateButton);

            await waitFor(() => {
                expect(mockSetTranslating).toHaveBeenCalledWith(true);
                expect(mockOnTranslate).toHaveBeenCalled();
            });

            // Verify TranslationService was created
            expect(TranslationService).toHaveBeenCalledWith(
                expect.objectContaining({
                    llmConfig: expect.objectContaining({
                        provider: 'openai',
                        apiKey: 'test-key'
                    }),
                    chunkSize: 50,
                    useTokenBasedChunking: false
                })
            );
        });

        it('should show progress during translation', () => {
            render(<TranslationTab {...defaultProps} isTranslating={true} progress={50} wholeProgress={25} />);

            expect(screen.getByText('buttons.translating')).toBeInTheDocument();
            expect(screen.getByText('progress.translatingMods 50%')).toBeInTheDocument();
            expect(screen.getByText('progress.wholeProgress 25%')).toBeInTheDocument();
            expect(screen.getByText('buttons.cancel')).toBeInTheDocument();
        });

        it('should handle translation cancellation', async () => {
            const mockTranslationService = {
                interruptJob: vi.fn()
            };
            mockSetTranslationServiceRef.mockImplementation((service) => {
                Object.assign(mockTranslationService, service);
            });

            const user = userEvent.setup();
            render(<TranslationTab {...defaultProps} isTranslating={true} currentJobId="job-123" />);

            const cancelButton = screen.getByText('buttons.cancel');
            await user.click(cancelButton);

            expect(mockSetError).toHaveBeenCalledWith('info.translationCancelled');
            expect(mockSetTranslating).toHaveBeenCalledWith(false);
            expect(mockSetProgress).toHaveBeenCalledWith(0);
            expect(mockSetWholeProgress).toHaveBeenCalledWith(0);
        });
    });

    describe('Filtering functionality', () => {
        it('should filter targets by name', async () => {
            const user = userEvent.setup();
            const targets = [
                {
                    type: 'mod',
                    id: 'minecraft',
                    name: 'Minecraft',
                    version: '1.20.1',
                    path: '/mods/minecraft.jar',
                    relativePath: 'minecraft.jar',
                    selected: true
                },
                {
                    type: 'mod',
                    id: 'jei',
                    name: 'Just Enough Items',
                    version: '11.6.0',
                    path: '/mods/jei.jar',
                    relativePath: 'jei.jar',
                    selected: true
                }
            ];

            render(<TranslationTab {...defaultProps} translationTargets={targets} />);

            const filterInput = screen.getByPlaceholderText('filters.filterMods');
            await user.type(filterInput, 'mine');

            expect(screen.getByText('Minecraft')).toBeInTheDocument();
            expect(screen.queryByText('Just Enough Items')).not.toBeInTheDocument();
        });

        it('should filter targets by id', async () => {
            const user = userEvent.setup();
            const targets = [
                {
                    type: 'mod',
                    id: 'minecraft',
                    name: 'Minecraft',
                    version: '1.20.1',
                    path: '/mods/minecraft.jar',
                    relativePath: 'minecraft.jar',
                    selected: true
                },
                {
                    type: 'mod',
                    id: 'jei',
                    name: 'Just Enough Items',
                    version: '11.6.0',
                    path: '/mods/jei.jar',
                    relativePath: 'jei.jar',
                    selected: true
                }
            ];

            render(<TranslationTab {...defaultProps} translationTargets={targets} />);

            const filterInput = screen.getByPlaceholderText('filters.filterMods');
            await user.type(filterInput, 'jei');

            expect(screen.queryByText('Minecraft')).not.toBeInTheDocument();
            expect(screen.getByText('Just Enough Items')).toBeInTheDocument();
        });
    });

    describe('Sorting functionality', () => {
        it('should sort targets by column', async () => {
            const user = userEvent.setup();
            const targets = [
                {
                    type: 'mod',
                    id: 'b-mod',
                    name: 'B Mod',
                    version: '2.0.0',
                    path: '/mods/b.jar',
                    relativePath: 'b.jar',
                    selected: true
                },
                {
                    type: 'mod',
                    id: 'a-mod',
                    name: 'A Mod',
                    version: '1.0.0',
                    path: '/mods/a.jar',
                    relativePath: 'a.jar',
                    selected: true
                }
            ];

            render(<TranslationTab {...defaultProps} translationTargets={targets} />);

            // Click on name column to sort
            const nameHeader = screen.getByText('tables.modName');
            await user.click(nameHeader);

            // Should be sorted A-Z by default
            const rows = screen.getAllByRole('row');
            expect(rows[1]).toHaveTextContent('A Mod');
            expect(rows[2]).toHaveTextContent('B Mod');

            // Click again to reverse
            await user.click(nameHeader);

            const reversedRows = screen.getAllByRole('row');
            expect(reversedRows[1]).toHaveTextContent('B Mod');
            expect(reversedRows[2]).toHaveTextContent('A Mod');
        });
    });

    describe('Error display', () => {
        it('should display errors', () => {
            render(<TranslationTab {...defaultProps} error="Test error message" />);

            expect(screen.getByText('Test error message')).toBeInTheDocument();
        });

        it('should clear errors on new operations', async () => {
            const user = userEvent.setup();
            render(<TranslationTab {...defaultProps} error="Test error message" />);

            expect(screen.getByText('Test error message')).toBeInTheDocument();

            // Select directory should clear error
            await user.click(screen.getByText('buttons.selectProfileDirectory'));

            expect(mockSetError).toHaveBeenCalledWith(null);
        });
    });
});