import { useCallback, useState } from 'react'
import { DndShell } from '@/shared/dnd'
import { ConfirmProvider } from '@/shared/ui/ConfirmModal'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { refreshAiStatus } from '@/shared/lib/aiStatus'
import { AddUrlModal, DragPreview, PinnedDragPreview } from '@/features/bookmarks'
import { PendingPanel } from '@/features/pending'
import { SearchBar } from '@/features/search'
import { Sidebar, SIDEBAR_WIDTH } from '@/features/sidebar'
import { SettingsModal } from '@/features/settings'
import { AiGuideModal, PrivacyModal, WhatsNewModal, useOnboardingFlow } from '@/features/onboarding'
import { Background } from '@/features/wallpaper'
import { Toaster } from '@/features/toast'
import { AppHeader } from './AppHeader'
import { AppMain } from './AppMain'
import { useAppController } from './useAppController'

export function App() {
  const app = useAppController()
  const onboarding = useOnboardingFlow()

  const [addOpen, setAddOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [focusAi, setFocusAi] = useState(false)

  const onOpenSettings = useCallback(() => {
    setFocusAi(false)
    setSettingsOpen(true)
  }, [])

  const onCloseSettings = useCallback(() => {
    setSettingsOpen(false)
    setFocusAi(false)
    void refreshAiStatus()
  }, [])

  return (
    <TooltipProvider>
      <ConfirmProvider>
        <Background />
        <DndShell
          sensors={app.dnd.sensors}
          onDragStart={app.dnd.handleDragStart}
          onDragOver={app.dnd.handleDragOver}
          onDragEnd={app.dnd.handleDragEnd}
          onDragCancel={app.dnd.handleDragCancel}
          overlay={
            app.dnd.activeItem &&
            (app.pinned.some((b) => b.id === app.dnd.activeItem!.id) ? (
              <PinnedDragPreview item={app.dnd.activeItem} />
            ) : (
              <DragPreview item={app.dnd.activeItem} morphed={app.dnd.overFolder} />
            ))
          }
        >
          <div
            className="min-h-screen w-full text-foreground transition-[padding] duration-200 ease-out"
            style={{ paddingLeft: sidebarOpen ? SIDEBAR_WIDTH : 0 }}
          >
            {onboarding.privacy === 'dismissed' && (
              <button
                onClick={onboarding.openPrivacyModal}
                className="w-full bg-warning text-white text-xs py-2 text-center hover:bg-warning/90 transition-colors"
              >
                完成授权以使用完整功能 →
              </button>
            )}

            <AppHeader
              filterPinned={app.filterPinned}
              sidebarOpen={sidebarOpen}
              activeFolderId={app.activeFolderId}
              scopeLabel={app.scopeLabel}
              isEmpty={app.isEmpty}
              allPinned={app.allPinned}
              onOpenSidebar={() => setSidebarOpen(true)}
              onOpenSettings={onOpenSettings}
            />

            <AppMain
              filterBarRef={app.filterBarRef}
              filterPinned={app.filterPinned}
              isEmpty={app.isEmpty}
              allPinned={app.allPinned}
              loading={app.loading}
              filter={app.filter}
              pinned={app.pinned}
              visible={app.visible}
              onOpen={app.openBookmark}
              onTogglePin={app.togglePinned}
              onDelete={app.remove}
              onAddUrl={() => setAddOpen(true)}
              onOpenSettings={() => { setFocusAi(true); setSettingsOpen(true) }}
            />

            <PendingPanel />
            {!app.isEmpty && <SearchBar onOpenSettings={onOpenSettings} />}

            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <Toaster position="top-center" richColors visibleToasts={1} />
            <AddUrlModal open={addOpen} onClose={() => setAddOpen(false)} />
            <SettingsModal open={settingsOpen} onClose={onCloseSettings} focusAi={focusAi} />

            <WhatsNewModal open={onboarding.showWhatsNew} onClose={onboarding.closeWhatsNew} />
            <AiGuideModal open={onboarding.showAiGuide} onClose={onboarding.closeAiGuide} />
            <PrivacyModal
              open={onboarding.showPrivacyModal}
              onAgree={onboarding.agreePrivacy}
              onDismiss={onboarding.dismissPrivacy}
            />
          </div>
        </DndShell>
      </ConfirmProvider>
    </TooltipProvider>
  )
}
