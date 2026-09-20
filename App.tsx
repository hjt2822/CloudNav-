
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Upload, Moon, Sun, Menu, 
  Trash2, Edit2, Loader2, Cloud, CheckCircle2, AlertCircle,
  Pin, Settings, Lock, CloudCog, Github, GitFork, MoreVertical,
  QrCode, Copy, LayoutGrid, List, Check, ExternalLink, ArrowRight,
  ChevronRight, ChevronDown
} from 'lucide-react';
import { 
    LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS, 
    WebDavConfig, AIConfig, SiteSettings, SearchEngine, DEFAULT_SEARCH_ENGINES,
    getRootCategories, getChildCategories, getDescendantIds, isDescendant, getCategoryPath, flattenCategoryTree
} from './types';
import Favicon from './components/Favicon';
import { getHostname } from './services/favicon';
import Icon from './components/Icon';
import LinkModal from './components/LinkModal';
import AuthModal from './components/AuthModal';
import CategoryManagerModal from './components/CategoryManagerModal';
import BackupModal from './components/BackupModal';
import CategoryAuthModal from './components/CategoryAuthModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import SearchSettingsModal from './components/SearchSettingsModal';

const GITHUB_REPO_URL = 'https://github.com/sese972010/CloudNav-';

const LOCAL_STORAGE_KEY = 'cloudnav_data_cache';
const AUTH_KEY = 'cloudnav_auth_token';
const WEBDAV_CONFIG_KEY = 'cloudnav_webdav_config';
const AI_CONFIG_KEY = 'cloudnav_ai_config';
const SEARCH_ENGINES_KEY = 'cloudnav_search_engines';

function App() {
  // --- State ---
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Search State
  const [searchMode, setSearchMode] = useState<'local' | 'external'>('local');
  const [externalEngines, setExternalEngines] = useState<SearchEngine[]>(() => {
      const saved = localStorage.getItem(SEARCH_ENGINES_KEY);
      if (saved) {
          try { return JSON.parse(saved); } catch(e) {}
      }
      // Filter out 'local' from defaults for the external list
      return DEFAULT_SEARCH_ENGINES.filter(e => e.id !== 'local');
  });
  const [activeEngineId, setActiveEngineId] = useState<string>(() => {
      return externalEngines[0]?.id || 'google';
  });
  const [isSearchSettingsOpen, setIsSearchSettingsOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Site Settings - Initialized with defaults to prevent crash
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
      title: 'CloudNav - 我的导航',
      navTitle: '云航 CloudNav',
      favicon: '',
      cardStyle: 'detailed'
  });
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, link: LinkItem | null } | null>(null);
  
  const [qrCodeLink, setQrCodeLink] = useState<LinkItem | null>(null);

  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());

  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>({
      url: '',
      username: '',
      password: '',
      enabled: false
  });

  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
      const saved = localStorage.getItem(AI_CONFIG_KEY);
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) {}
      }
      
      // Safe access to process env
      let defaultKey = '';
      try {
          if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
              defaultKey = process.env.API_KEY;
          }
      } catch(e) {}

      return {
          provider: 'gemini',
          apiKey: defaultKey, 
          baseUrl: '',
          model: 'gemini-2.5-flash'
      };
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);
  
  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authToken, setAuthToken] = useState<string>('');

  const mainRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---

  const loadFromLocal = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setLinks(parsed.links || INITIAL_LINKS);
        setCategories(parsed.categories || DEFAULT_CATEGORIES);
        if (parsed.settings) setSiteSettings(prev => ({ ...prev, ...parsed.settings }));
      } catch (e) {
        setLinks(INITIAL_LINKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setLinks(INITIAL_LINKS);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const syncToCloud = async (newLinks: LinkItem[], newCategories: Category[], newSettings: SiteSettings, token: string) => {
    setSyncStatus('saving');
    try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': token
            },
            body: JSON.stringify({ links: newLinks, categories: newCategories, settings: newSettings })
        });

        if (response.status === 401) {
            setAuthToken('');
            localStorage.removeItem(AUTH_KEY);
            setIsAuthOpen(true);
            setSyncStatus('error');
            return false;
        }

        if (!response.ok) throw new Error('Network response was not ok');
        
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return true;
    } catch (error) {
        console.error("Sync failed", error);
        setSyncStatus('error');
        return false;
    }
  };

  const updateData = (newLinks: LinkItem[], newCategories: Category[], newSettings: SiteSettings = siteSettings) => {
      setLinks(newLinks);
      setCategories(newCategories);
      setSiteSettings(newSettings);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: newLinks, categories: newCategories, settings: newSettings }));
      if (authToken) {
          syncToCloud(newLinks, newCategories, newSettings, authToken);
      }
  };

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
    const savedToken = localStorage.getItem(AUTH_KEY);
    if (savedToken) setAuthToken(savedToken);

    const savedWebDav = localStorage.getItem(WEBDAV_CONFIG_KEY);
    if (savedWebDav) {
        try {
            setWebDavConfig(JSON.parse(savedWebDav));
        } catch (e) {}
    }

    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
        const addTitle = urlParams.get('add_title') || '';
        window.history.replaceState({}, '', window.location.pathname);
        setPrefillLink({
            title: addTitle,
            url: addUrl,
            categoryId: 'common'
        });
        setEditingLink(undefined);
        setIsModalOpen(true);
    }

    const initData = async () => {
        try {
            const res = await fetch('/api/storage');
            if (res.ok) {
                const data = await res.json();
                if (data.links && data.links.length > 0) {
                    setLinks(data.links);
                    setCategories(data.categories || DEFAULT_CATEGORIES);
                    if (data.settings) setSiteSettings(prev => ({ ...prev, ...data.settings }));
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
                    return;
                }
            } 
        } catch (e) {
            console.warn("Failed to fetch from cloud, falling back to local.", e);
        }
        loadFromLocal();
    };

    initData();
  }, []);

  useEffect(() => {
      document.title = siteSettings.title || 'CloudNav';
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link && siteSettings.favicon) {
          link.href = siteSettings.favicon;
      }
  }, [siteSettings]);

  useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
          if (openMenuId) setOpenMenuId(null);
          if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
             setContextMenu(null);
          }
      };
      
      const handleScroll = () => {
         if (contextMenu) setContextMenu(null);
      };

      window.addEventListener('click', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true); 
      
      const handleGlobalContextMenu = (e: MouseEvent) => {
          if (contextMenu) {
              e.preventDefault();
              setContextMenu(null);
          }
      }
      window.addEventListener('contextmenu', handleGlobalContextMenu);

      return () => {
          window.removeEventListener('click', handleClickOutside);
          window.removeEventListener('scroll', handleScroll, true);
          window.removeEventListener('contextmenu', handleGlobalContextMenu);
      }
  }, [openMenuId, contextMenu]);

  useEffect(() => {
    const handleScroll = () => {
        if (isAutoScrollingRef.current) return;
        if (!mainRef.current) return;
        
        const scrollPosition = mainRef.current.scrollTop + 150;

        if (mainRef.current.scrollTop < 80) {
            setActiveCategory('all');
            return;
        }

        let currentCatId = 'all';
        for (const cat of flattenCategoryTree(categories)) {
            const el = document.getElementById(`cat-${cat.id}`);
            if (el && el.offsetTop <= scrollPosition && (el.offsetTop + el.offsetHeight) > scrollPosition) {
                currentCatId = cat.id;
                break;
            }
        }
        if (currentCatId !== 'all') setActiveCategory(currentCatId);
    };

    const mainEl = mainRef.current;
    if (mainEl) mainEl.addEventListener('scroll', handleScroll);
    return () => mainEl?.removeEventListener('scroll', handleScroll);
  }, [categories]);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // --- Handlers ---
  const handleLogin = async (password: string): Promise<boolean> => {
      try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': password
            },
            body: JSON.stringify({ links, categories, settings: siteSettings })
        });
        
        if (response.ok) {
            setAuthToken(password);
            localStorage.setItem(AUTH_KEY, password);
            setIsAuthOpen(false);
            setSyncStatus('saved');
            return true;
        }
        return false;
      } catch (e) {
          return false;
      }
  };

  const handleImportConfirm = (newLinks: LinkItem[], newCategories: Category[]) => {
      const mergedCategories = [...categories];
      newCategories.forEach(nc => {
          const exists = mergedCategories.some(c =>
              c.id === nc.id ||
              (c.name === nc.name && (c.parentId || '') === (nc.parentId || ''))
          );
          if (!exists) mergedCategories.push(nc);
      });
      const mergedLinks = [...links, ...newLinks];
      updateData(mergedLinks, mergedCategories);
      setIsImportModalOpen(false);
      alert(`成功导入 ${newLinks.length} 个新书签!`);
  };

  const handleAddLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    const newLink: LinkItem = {
      ...data,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    updateData([newLink, ...links], categories);
    setPrefillLink(undefined);
  };

  const handleEditLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (!editingLink) return;
    const updated = links.map(l => l.id === editingLink.id ? { ...l, ...data } : l);
    updateData(updated, categories);
    setEditingLink(undefined);
  };

  const handleDeleteLink = (id: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (confirm('确定删除此链接吗?')) {
      updateData(links.filter(l => l.id !== id), categories);
    }
  };

  const togglePin = (id: string) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      const updated = links.map(l => l.id === id ? { ...l, pinned: !l.pinned } : l);
      updateData(updated, categories);
  };
  
  const handleCopyLink = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  const handleSaveAIConfig = (config: AIConfig, newSiteSettings: SiteSettings) => {
      setAiConfig(config);
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
      if (authToken) {
          updateData(links, categories, newSiteSettings);
      } else {
          setSiteSettings(newSiteSettings);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links, categories, settings: newSiteSettings }));
      }
  };

  const scrollToCategory = (catId: string) => {
      setActiveCategory(catId);
      setSidebarOpen(false);
      
      if (catId === 'all') {
          isAutoScrollingRef.current = true;
          mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(() => isAutoScrollingRef.current = false, 800);
          return;
      }
      const cat = categories.find(c => c.id === catId);
      // Expand all ancestors so the target node is visible in the sidebar
      const nextExpanded = new Set(expandedCategoryIds);
      let cursor: Category | undefined = cat;
      const guard = new Set<string>();
      while (cursor && !guard.has(cursor.id)) {
          guard.add(cursor.id);
          if (cursor.parentId) nextExpanded.add(cursor.parentId);
          cursor = cursor.parentId ? categories.find(c => c.id === cursor!.parentId) : undefined;
      }
      setExpandedCategoryIds(nextExpanded);
      const el = document.getElementById(`cat-${catId}`);
      if (el) {
          isAutoScrollingRef.current = true;
          const top = el.offsetTop - 80;
          mainRef.current?.scrollTo({ top, behavior: 'smooth' });
          setTimeout(() => isAutoScrollingRef.current = false, 800);
      }
  };

  const toggleExpandCategory = (catId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedCategoryIds(prev => {
          const next = new Set(prev);
          if (next.has(catId)) next.delete(catId);
          else next.add(catId);
          return next;
      });
  };

  const handleUnlockCategory = (catId: string) => {
      setUnlockedCategoryIds(prev => new Set(prev).add(catId));
  };

  const handleUpdateCategories = (newCats: Category[], newLinks?: LinkItem[]) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      updateData(newLinks || links, newCats);
  };

  const handleDeleteCategory = (catId: string) => {
      if (!authToken) { setIsAuthOpen(true); return; }
      const cat = categories.find(c => c.id === catId);
      const newCats = categories
        .filter(c => c.id !== catId)
        .map(c => c.parentId === catId ? { ...c, parentId: cat?.parentId } : c);
      const targetId = cat?.parentId || 'common';
      const fallbackId = newCats.some(c => c.id === targetId) ? targetId : (newCats[0]?.id || 'common');
      const newLinks = links.map(l => l.categoryId === catId ? { ...l, categoryId: fallbackId } : l);
      if (newCats.length === 0) newCats.push(DEFAULT_CATEGORIES[0]);
      updateData(newLinks, newCats);
  };

  const handleSaveWebDavConfig = (config: WebDavConfig) => {
      setWebDavConfig(config);
      localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  };

  const handleRestoreBackup = (restoredLinks: LinkItem[], restoredCategories: Category[]) => {
      updateData(restoredLinks, restoredCategories);
      setIsBackupModalOpen(false);
  };
  
  // Updated Search Logic
  const handleSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;
      
      if (searchMode === 'external') {
          const engine = externalEngines.find(e => e.id === activeEngineId) || externalEngines[0];
          if (engine) {
              window.open(engine.url + encodeURIComponent(searchQuery), '_blank');
              setSearchQuery('');
          }
      }
  };

  const handleUpdateSearchEngines = (newEngines: SearchEngine[]) => {
      setExternalEngines(newEngines);
      localStorage.setItem(SEARCH_ENGINES_KEY, JSON.stringify(newEngines));
  };

  const isCategoryLocked = (catId: string) => {
      const cat = categories.find(c => c.id === catId);
      if (!cat || !cat.password) return false;
      return !unlockedCategoryIds.has(catId);
  };

  const pinnedLinks = useMemo(() => {
      return links.filter(l => l.pinned && !isCategoryLocked(l.categoryId));
  }, [links, categories, unlockedCategoryIds]);

  const searchResults = useMemo(() => {
    // Only filter locally if mode is 'local'
    if (searchMode !== 'local') return links;

    let result = links;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => 
        l.title.toLowerCase().includes(q) || 
        l.url.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        (l.tags && l.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    return result;
  }, [links, searchQuery, searchMode]);

  // --- Link Drag & Drop (reorder within category / move across categories) ---
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
  const [dropTargetLinkId, setDropTargetLinkId] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<'before' | 'after'>('after');
  const [dropTargetCatId, setDropTargetCatId] = useState<string | null>(null);

  const clearLinkDrag = () => {
      setDraggedLinkId(null);
      setDropTargetLinkId(null);
      setDropTargetCatId(null);
      setDropPos('after');
  };

  const handleLinkDragStart = (e: React.DragEvent, link: LinkItem) => {
      setDraggedLinkId(link.id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', link.id);
  };

  const handleLinkDragOverCard = (e: React.DragEvent, link: LinkItem) => {
      if (!draggedLinkId || draggedLinkId === link.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = e.currentTarget.getBoundingClientRect();
      setDropPos(e.clientX < rect.left + rect.width / 2 ? 'before' : 'after');
      setDropTargetLinkId(link.id);
      setDropTargetCatId(null);
  };

  const handleLinkDropOnCard = (e: React.DragEvent, target: LinkItem) => {
      e.preventDefault();
      e.stopPropagation();
      const srcId = draggedLinkId;
      if (!srcId || srcId === target.id) { clearLinkDrag(); return; }
      const src = links.find(l => l.id === srcId);
      if (!src) { clearLinkDrag(); return; }
      const newLinks = links.filter(l => l.id !== srcId);
      const tIdx = newLinks.findIndex(l => l.id === target.id);
      const insertIdx = dropPos === 'after' ? tIdx + 1 : tIdx;
      newLinks.splice(insertIdx, 0, { ...src, categoryId: target.categoryId });
      updateData(newLinks, categories);
      clearLinkDrag();
  };

  const handleLinkDragOverSection = (e: React.DragEvent, catId: string) => {
      if (!draggedLinkId) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setDropTargetCatId(catId);
      setDropTargetLinkId(null);
  };

  const handleLinkDropOnSection = (e: React.DragEvent, catId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const srcId = draggedLinkId;
      if (!srcId) { clearLinkDrag(); return; }
      const src = links.find(l => l.id === srcId);
      if (!src) { clearLinkDrag(); return; }
      const newLinks = links.filter(l => l.id !== srcId);
      const moved = { ...src, categoryId: catId };
      let insertAt = -1;
      for (let i = newLinks.length - 1; i >= 0; i--) {
          if (newLinks[i].categoryId === catId) { insertAt = i + 1; break; }
      }
      if (insertAt >= 0) newLinks.splice(insertAt, 0, moved);
      else newLinks.push(moved);
      updateData(newLinks, categories);
      clearLinkDrag();
  };

  const activeExternalEngine = useMemo(() => {
      return externalEngines.find(e => e.id === activeEngineId) || externalEngines[0];
  }, [externalEngines, activeEngineId]);

  // --- Render Components ---

  const renderLinkCard = (link: LinkItem) => {
      const isSimple = siteSettings.cardStyle === 'simple';
      const isDragging = draggedLinkId === link.id;
      const isDropTarget = dropTargetLinkId === link.id;

      // NavSphere 卡片结构：Card 外壳（hover 上浮）+ block 链接 + p-6 头部
      // 图标左（w-8→sm:w-11），右侧标题 font-semibold 与描述分层
      if (isSimple) {
          return (
            <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                draggable
                onDragStart={(e) => handleLinkDragStart(e, link)}
                onDragOver={(e) => handleLinkDragOverCard(e, link)}
                onDragLeave={() => { if (dropTargetLinkId === link.id) setDropTargetLinkId(null); }}
                onDrop={(e) => handleLinkDropOnCard(e, link)}
                onDragEnd={clearLinkDrag}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    let x = e.clientX;
                    let y = e.clientY;
                    if (x + 180 > window.innerWidth) x = window.innerWidth - 190;
                    if (y + 220 > window.innerHeight) y = window.innerHeight - 230;
                    setContextMenu({ x, y, link });
                    return false;
                }}
                className={`group relative flex items-center p-2 gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-in-out ${
                  isDragging ? 'opacity-40' : ''
                } ${isDropTarget ? 'ring-2 ring-blue-400 border-transparent' : ''}`}
                title={link.description || link.url}
            >
                <Favicon url={link.url} icon={link.icon} title={link.title} className="w-6 h-6" letterClassName="text-xs" />
                <h3 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {link.title}
                </h3>
            </a>
          );
      }

      return (
        <div
            key={link.id}
            draggable
            onDragStart={(e) => handleLinkDragStart(e, link)}
            onDragOver={(e) => handleLinkDragOverCard(e, link)}
            onDragLeave={() => { if (dropTargetLinkId === link.id) setDropTargetLinkId(null); }}
            onDrop={(e) => handleLinkDropOnCard(e, link)}
            onDragEnd={clearLinkDrag}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                let x = e.clientX;
                let y = e.clientY;
                if (x + 180 > window.innerWidth) x = window.innerWidth - 190;
                if (y + 220 > window.innerHeight) y = window.innerHeight - 230;
                setContextMenu({ x, y, link });
                return false;
            }}
            className={`rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow overflow-hidden transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-lg cursor-pointer ${
              isDragging ? 'opacity-40' : ''
            } ${isDropTarget ? 'ring-2 ring-blue-400 border-transparent' : ''}`}
        >
            <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full"
                title={link.description || link.url}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col space-y-1.5 p-6">
                    <div className="flex items-start gap-2 sm:gap-4">
                        <div className="flex-shrink-0 w-8 h-8 sm:w-11 sm:h-11">
                            <Favicon url={link.url} icon={link.icon} title={link.title} className="w-full h-full" />
                        </div>
                        <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
                            <div className="font-semibold tracking-tight text-sm sm:text-base text-slate-800 dark:text-slate-200 truncate">
                                {link.title}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm line-clamp-1">
                                {link.description || getHostname(link.url)}
                            </div>
                            {link.tags && link.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                    {link.tags.slice(0, 3).map(tag => (
                                        <span
                                            key={tag}
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSearchMode('local'); setSearchQuery(tag); }}
                                            className="text-[10px] leading-none px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-300 cursor-pointer transition-colors"
                                            title={`筛选标签: ${tag}`}
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </a>
        </div>
      );
  };

  // Auto-expand ancestors of the active category
  useEffect(() => {
      if (!activeCategory) return;
      const nextExpanded = new Set(expandedCategoryIds);
      let cursor = categories.find(c => c.id === activeCategory);
      const guard = new Set<string>();
      while (cursor && cursor.parentId && !guard.has(cursor.id)) {
          guard.add(cursor.id);
          nextExpanded.add(cursor.parentId);
          cursor = categories.find(c => c.id === cursor!.parentId);
      }
      if (nextExpanded.size !== expandedCategoryIds.size || [...nextExpanded].some(id => !expandedCategoryIds.has(id))) {
          setExpandedCategoryIds(nextExpanded);
      }
  }, [activeCategory, categories]);

  const renderSidebarCategory = (cat: Category, depth: number): React.ReactNode => {
      const children = getChildCategories(categories, cat.id);
      const hasChildren = children.length > 0;
      const isExpanded = expandedCategoryIds.has(cat.id);
      const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);
      const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
      const isActive = activeCategory === cat.id;

      return (
        <div key={cat.id} className="space-y-0.5">
          <button
            onClick={() => scrollToCategory(cat.id)}
            className={`w-full flex items-center gap-2 rounded-xl transition-all group ${
              depth === 0 ? 'px-3 py-2.5' : 'px-3 py-2'
            } ${
              isActive 
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {hasChildren ? (
              <span
                onClick={(e) => toggleExpandCategory(cat.id, e)}
                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 shrink-0"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : (
              <span className="w-[18px] shrink-0" />
            )}
            <div className={`${depth === 0 ? 'p-1.5' : 'p-1'} rounded-lg transition-colors flex items-center justify-center shrink-0 ${isActive ? 'bg-blue-100 dark:bg-blue-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
              {isLocked ? <Lock size={depth === 0 ? 16 : 14} className="text-amber-500" /> : (isEmoji ? <span className={depth === 0 ? 'text-base leading-none' : 'text-sm leading-none'}>{cat.icon}</span> : <Icon name={cat.icon} size={depth === 0 ? 16 : 14} />)}
            </div>
            <span className="truncate flex-1 text-left text-sm">{cat.name}</span>
            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>}
          </button>
          {hasChildren && isExpanded && (
            <div className="ml-4 pl-2 border-l border-slate-200 dark:border-slate-700 space-y-0.5">
              {children.map(child => renderSidebarCategory(child, depth + 1))}
            </div>
          )}
        </div>
      );
  };

  const matchCountFor = (catId: string): number => {
      let count = searchResults.filter(l => l.categoryId === catId).length;
      for (const cid of getDescendantIds(categories, catId)) {
          count += searchResults.filter(l => l.categoryId === cid).length;
      }
      return count;
  };

  const renderLockedBox = (lockedCat: Category) => (
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
              <Lock size={24} />
          </div>
          <h3 className="text-slate-800 dark:text-slate-200 font-medium mb-1">私密目录</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">该分类已加密，需要验证密码才能查看内容</p>
          <button 
              onClick={() => setCatAuthModalData(lockedCat)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
              输入密码解锁
          </button>
      </div>
  );

  const renderLinkGrid = (sectionLinks: LinkItem[]) => (
      sectionLinks.length === 0 ? null : (
          <div className={`grid gap-3 ${siteSettings.cardStyle === 'simple' ? 'grid-cols-2 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'}`}>
              {sectionLinks.map(link => renderLinkCard(link))}
          </div>
      )
  );

  const renderCategorySection = (cat: Category, depth: number): React.ReactNode => {
      const children = getChildCategories(categories, cat.id);
      const catLinks = searchResults.filter(l => l.categoryId === cat.id);
      const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);
      const searching = searchQuery.trim() !== '' && searchMode === 'local';
      const totalMatches = matchCountFor(cat.id);

      if (searching && totalMatches === 0 && !isLocked) return null;
      if (!searching && depth > 0 && catLinks.length === 0 && children.length === 0 && !isLocked) return null;

      const isEmoji = cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon);
      const isDropTargetCat = dropTargetCatId === cat.id;
      const showEmptyHint = catLinks.length === 0 && children.length === 0 && !isLocked;

      return (
          <section 
            key={cat.id} 
            id={`cat-${cat.id}`} 
            className="scroll-mt-24 space-y-6"
            onDragOver={(e) => handleLinkDragOverSection(e, cat.id)}
            onDrop={(e) => handleLinkDropOnSection(e, cat.id)}
          >
              <div className={isDropTargetCat ? 'rounded-xl ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900' : ''}>
                  <div 
                    className={`flex items-center gap-2 ${depth === 0 ? 'mb-4 pb-2 border-b border-slate-100 dark:border-slate-800' : 'mb-3'}`}
                  >
                      <div className="text-slate-400 cursor-pointer" onClick={() => setIsCatManagerOpen(true)}>
                          {isEmoji ? <span className={depth === 0 ? 'text-lg' : 'text-base'}>{cat.icon}</span> : <Icon name={cat.icon} size={depth === 0 ? 20 : 16} />}
                      </div>
                      <h2 
                        onClick={() => setIsCatManagerOpen(true)}
                        className={`${depth === 0 ? 'text-base font-medium tracking-tight text-slate-800 dark:text-slate-200' : 'text-sm font-medium tracking-tight text-slate-700 dark:text-slate-300'} cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors`}
                        title="点击编辑分类"
                      >
                          {cat.name}
                      </h2>
                      {isLocked && <Lock size={16} className="text-amber-500" />}
                  </div>
                  
                  {isLocked ? renderLockedBox(cat) : (
                    <>
                      {renderLinkGrid(catLinks)}
                      {showEmptyHint && (
                          <div className="text-center py-8 text-slate-400 text-sm italic border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                              暂无链接，拖拽其他链接到此分类，或点击标题旁图标编辑分类
                          </div>
                      )}
                    </>
                  )}
              </div>

              {!isLocked && children.length > 0 && (
                  <div className={depth === 0 ? 'space-y-6' : 'space-y-5 pl-3 border-l-2 border-slate-100 dark:border-slate-800'}>
                      {children.map(child => renderCategorySection(child, depth + 1))}
                  </div>
              )}
          </section>
      );
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      
      {/* Right Click Context Menu */}
      {contextMenu && (
          <div 
             ref={contextMenuRef}
             className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-600 w-44 py-2 flex flex-col animate-in fade-in zoom-in duration-100 overflow-hidden"
             style={{ top: contextMenu.y, left: contextMenu.x }}
             onClick={(e) => e.stopPropagation()}
             onContextMenu={(e) => e.preventDefault()}
          >
             <button onClick={() => { handleCopyLink(contextMenu.link!.url); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <Copy size={16} className="text-slate-400"/> <span>复制链接</span>
             </button>
             <button onClick={() => { setQrCodeLink(contextMenu.link); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <QrCode size={16} className="text-slate-400"/> <span>显示二维码</span>
             </button>
             <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"/>
             <button onClick={() => { if(!authToken) setIsAuthOpen(true); else { setEditingLink(contextMenu.link!); setIsModalOpen(true); setContextMenu(null); }}} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <Edit2 size={16} className="text-slate-400"/> <span>编辑链接</span>
             </button>
             <button onClick={() => { togglePin(contextMenu.link!.id); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-left">
                 <Pin size={16} className={contextMenu.link!.pinned ? "fill-current text-blue-500" : "text-slate-400"}/> <span>{contextMenu.link!.pinned ? '取消置顶' : '置顶'}</span>
             </button>
             <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"/>
             <button onClick={() => { handleDeleteLink(contextMenu.link!.id); setContextMenu(null); }} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors text-left">
                 <Trash2 size={16}/> <span>删除链接</span>
             </button>
          </div>
      )}

      {/* QR Code Modal */}
      {qrCodeLink && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setQrCodeLink(null)}>
              <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold text-lg text-slate-800">{qrCodeLink.title}</h3>
                  <div className="p-2 border border-slate-200 rounded-lg">
                    <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCodeLink.url)}`} 
                        alt="QR Code" 
                        className="w-48 h-48"
                    />
                  </div>
                  <p className="text-xs text-slate-500 max-w-[200px] truncate">{qrCodeLink.url}</p>
              </div>
          </div>
      )}

      <AuthModal isOpen={isAuthOpen} onLogin={handleLogin} />
      
      <CategoryAuthModal 
        isOpen={!!catAuthModalData}
        category={catAuthModalData}
        onClose={() => setCatAuthModalData(null)}
        onUnlock={handleUnlockCategory}
      />

      <CategoryManagerModal 
        isOpen={isCatManagerOpen} 
        onClose={() => setIsCatManagerOpen(false)}
        categories={categories}
        links={links}
        onUpdateCategories={handleUpdateCategories}
        onDeleteCategory={handleDeleteCategory}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        links={links}
        categories={categories}
        onRestore={handleRestoreBackup}
        webDavConfig={webDavConfig}
        onSaveWebDavConfig={handleSaveWebDavConfig}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingLinks={links}
        categories={categories}
        onImport={handleImportConfirm}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={aiConfig}
        siteSettings={siteSettings}
        onSave={handleSaveAIConfig}
        links={links}
        categories={categories}
        onUpdateLinks={(newLinks) => updateData(newLinks, categories)}
      />

      <SearchSettingsModal
        isOpen={isSearchSettingsOpen}
        onClose={() => setIsSearchSettingsOpen(false)}
        engines={externalEngines}
        activeEngineId={activeEngineId}
        onUpdateEngines={handleUpdateSearchEngines}
        onSelectEngine={setActiveEngineId}
      />

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
          bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700 shrink-0 gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/30 overflow-hidden">
                 {siteSettings.favicon ? (
                    <img src={siteSettings.favicon} alt="" className="w-full h-full object-cover" />
                 ) : (
                    "C"
                 )}
             </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent truncate">
              {siteSettings.navTitle || 'CloudNav'}
            </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
            <button
              onClick={() => scrollToCategory('all')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeCategory === 'all' 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="p-1"><Icon name="LayoutGrid" size={18} /></div>
              <span>全部链接</span>
            </button>
            
            <div className="flex items-center justify-between pt-4 pb-2 px-4">
               <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">分类目录</span>
               <button 
                  onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsCatManagerOpen(true); }}
                  className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  title="管理分类"
               >
                  <Settings size={14} />
               </button>
            </div>

            {getRootCategories(categories).map(cat => renderSidebarCategory(cat, 0))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div className="grid grid-cols-3 gap-2 mb-2">
                <button 
                    onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsImportModalOpen(true); }}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                    title="导入书签"
                >
                    <Upload size={14} />
                    <span>导入</span>
                </button>
                <button 
                    onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsBackupModalOpen(true); }}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                    title="备份与恢复"
                >
                    <CloudCog size={14} />
                    <span>备份</span>
                </button>
                <button 
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-all"
                    title="AI 设置"
                >
                    <Settings size={14} />
                    <span>设置</span>
                </button>
            </div>
            
            <div className="flex items-center justify-between text-xs px-2 mt-2">
               <div className="flex items-center gap-1 text-slate-400">
                 {syncStatus === 'saving' && <Loader2 className="animate-spin w-3 h-3 text-blue-500" />}
                 {syncStatus === 'saved' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                 {syncStatus === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                 {authToken ? <span className="text-green-600">已同步</span> : <span className="text-amber-500">离线</span>}
               </div>
               <a 
                 href={GITHUB_REPO_URL} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                 title="Fork this project on GitHub"
               >
                 <GitFork size={14} />
                 <span>Fork 项目</span>
               </a>
            </div>
        </div>
      </aside>

      <main 
          ref={mainRef}
          className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto relative scroll-smooth"
      >
        <header className="h-16 px-4 lg:px-8 flex items-center justify-between bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300">
              <Menu size={24} />
            </button>

            {/* Redesigned Search Bar */}
            <div className="relative w-full max-w-xl hidden sm:flex items-center gap-3">
                {/* Search Mode Toggle (Pill) */}
                <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-full flex items-center shrink-0">
                    <button
                        onClick={() => setSearchMode('local')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                            searchMode === 'local' 
                            ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        站内
                    </button>
                    <button
                        onClick={() => setSearchMode('external')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                            searchMode === 'external' 
                            ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        站外
                    </button>
                </div>

                {/* Settings Gear (Visible only for External) */}
                {searchMode === 'external' && (
                    <button 
                        onClick={() => setIsSearchSettingsOpen(true)}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors animate-in fade-in slide-in-from-left-2 duration-200"
                        title="管理搜索引擎"
                    >
                        <Settings size={18} />
                    </button>
                )}

                {/* Search Input */}
                <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center group">
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder={searchMode === 'local' ? "搜索书签..." : `在 ${activeExternalEngine?.name} 搜索...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded-full text-sm dark:text-white placeholder-slate-400 outline-none transition-all focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/50"
                    />
                    <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center gap-2">
                        {searchMode === 'local' ? (
                            <Search size={16} />
                        ) : activeExternalEngine?.icon?.startsWith('http') ? (
                            <img src={activeExternalEngine.icon} className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                            <Search size={16} />
                        )}
                    </div>
                    
                    {/* Visual Indicator for Search */}
                    {searchQuery && (
                        <button type="submit" className="absolute right-2 p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-full hover:bg-blue-200 transition-colors">
                            <ArrowRight size={14} />
                        </button>
                    )}
                </form>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 mr-2">
                <button 
                    onClick={() => authToken && updateData(links, categories, { ...siteSettings, cardStyle: 'simple' })}
                    title="简约模式"
                    className={`p-1.5 rounded transition-all ${siteSettings.cardStyle === 'simple' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <LayoutGrid size={16} />
                </button>
                <button 
                    onClick={() => authToken && updateData(links, categories, { ...siteSettings, cardStyle: 'detailed' })}
                    title="详情模式"
                    className={`p-1.5 rounded transition-all ${siteSettings.cardStyle === 'detailed' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <List size={16} />
                </button>
            </div>

            <button onClick={toggleTheme} className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {!authToken && (
                <button onClick={() => setIsAuthOpen(true)} className="hidden sm:flex items-center gap-2 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-medium">
                    <Cloud size={14} /> 登录
                </button>
            )}

            <button
              onClick={() => { if(!authToken) setIsAuthOpen(true); else { setEditingLink(undefined); setIsModalOpen(true); }}}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full text-sm font-medium shadow-lg shadow-blue-500/30"
            >
              <Plus size={16} /> <span className="hidden sm:inline">添加</span>
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8 space-y-8">
            
            {pinnedLinks.length > 0 && !searchQuery && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Pin size={16} className="text-blue-500 fill-blue-500" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            置顶 / 常用
                        </h2>
                    </div>
                    <div className={`grid gap-3 ${siteSettings.cardStyle === 'simple' ? 'grid-cols-2 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'}`}>
                        {pinnedLinks.map(link => renderLinkCard(link))}
                    </div>
                </section>
            )}

            {getRootCategories(categories).map(cat => renderCategorySection(cat, 0))}
            
            {/* Empty State for Local Search */}
            {searchQuery && searchMode === 'local' && searchResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Search size={40} className="opacity-30 mb-4" />
                    <p>没有找到相关内容</p>
                    <button onClick={() => setIsModalOpen(true)} className="mt-4 text-blue-500 hover:underline">添加一个?</button>
                </div>
            )}

            <div className="h-20"></div>
        </div>
      </main>

      <LinkModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }}
        onSave={editingLink ? handleEditLink : handleAddLink}
        categories={categories}
        existingLinks={links}
        initialData={editingLink || (prefillLink as LinkItem)}
        aiConfig={aiConfig}
      />
    </div>
  );
}

export default App;
