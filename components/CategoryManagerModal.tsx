
import React, { useState } from 'react';
import { X, ArrowUp, ArrowDown, Trash2, Edit2, Plus, Check, Lock, Merge, CornerDownRight } from 'lucide-react';
import { Category, LinkItem, getChildCategories, getRootCategories, isDescendant, getCategoryPath } from '../types';
import Icon from './Icon';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  links: LinkItem[];
  onUpdateCategories: (newCategories: Category[], newLinks?: LinkItem[]) => void;
  onDeleteCategory: (id: string) => void;
}

const COMMON_ICONS = [
  { value: 'Folder', label: '文件夹' },
  { value: 'Star', label: '收藏/星标' },
  { value: 'Code', label: '开发/代码' },
  { value: 'Palette', label: '设计/调色板' },
  { value: 'BookOpen', label: '阅读/书籍' },
  { value: 'Gamepad2', label: '游戏/娱乐' },
  { value: 'Bot', label: '人工智能/机器人' },
  { value: 'ShoppingBag', label: '购物/商店' },
  { value: 'Globe', label: '全球/网络' },
  { value: 'Server', label: '服务器/运维' },
  { value: 'Terminal', label: '终端/系统' },
  { value: 'Cpu', label: '硬件/芯片' },
  { value: 'Music', label: '音乐' },
  { value: 'Video', label: '视频' },
  { value: 'Image', label: '图片' },
  { value: 'Mail', label: '邮箱' },
  { value: 'MessageCircle', label: '社交/聊天' },
  { value: 'Briefcase', label: '办公/工作' },
  { value: 'Cloud', label: '云服务' },
  { value: 'Shield', label: '安全' },
  { value: 'Newspaper', label: '资讯/媒体' },
  { value: 'Wrench', label: '工具' },
  { value: 'TrendingUp', label: '投资/趋势' },
  { value: 'Megaphone', label: '自媒体' },
  { value: 'Package', label: '组件/SDK' },
  { value: 'Layout', label: '界面/布局' },
  { value: 'Sparkles', label: 'AI/创意' },
];

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({ 
  isOpen, 
  onClose, 
  categories, 
  links,
  onUpdateCategories,
  onDeleteCategory
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editParentId, setEditParentId] = useState('');
  
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Folder');
  const [newCatPassword, setNewCatPassword] = useState('');
  const [newCatParentId, setNewCatParentId] = useState('');

  const [mergingCatId, setMergingCatId] = useState<string | null>(null);
  const [targetMergeId, setTargetMergeId] = useState<string>('');

  // Category drag & drop (nest under another category)
  const [dragCatId, setDragCatId] = useState<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);

  if (!isOpen) return null;

  const rootCats = getRootCategories(categories);

  const clearDrag = () => {
    setDragCatId(null);
    setDragOverCatId(null);
    setDragOverRoot(false);
  };

  const handleCatDragStart = (e: React.DragEvent, cat: Category) => {
    setDragCatId(cat.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cat.id);
  };

  const handleCatDragOverRow = (e: React.DragEvent, cat: Category) => {
    if (!dragCatId || dragCatId === cat.id) return;
    if (isDescendant(categories, dragCatId, cat.id)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCatId(cat.id);
    setDragOverRoot(false);
  };

  const handleCatDropRow = (e: React.DragEvent, target: Category) => {
    e.preventDefault();
    e.stopPropagation();
    const srcId = dragCatId;
    if (!srcId || srcId === target.id || isDescendant(categories, srcId, target.id)) { clearDrag(); return; }
    const src = categories.find(c => c.id === srcId);
    if (src && (src.parentId || '') !== target.id) {
      onUpdateCategories(categories.map(c => c.id === srcId ? { ...c, parentId: target.id } : c));
    }
    clearDrag();
  };

  const handleCatDragOverRoot = (e: React.DragEvent) => {
    if (!dragCatId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverRoot(true);
    setDragOverCatId(null);
  };

  const handleCatDropRoot = (e: React.DragEvent) => {
    e.preventDefault();
    const srcId = dragCatId;
    if (!srcId) { clearDrag(); return; }
    const src = categories.find(c => c.id === srcId);
    if (src && src.parentId) {
      onUpdateCategories(categories.map(c => c.id === srcId ? { ...c, parentId: undefined } : c));
    }
    clearDrag();
  };

  const handleMove = (cat: Category, direction: 'up' | 'down') => {
    const siblings = categories.filter(c => (c.parentId || '') === (cat.parentId || ''));
    const index = siblings.findIndex(c => c.id === cat.id);
    const swapWith = direction === 'up' ? siblings[index - 1] : siblings[index + 1];
    if (!swapWith) return;
    const i1 = categories.findIndex(c => c.id === cat.id);
    const i2 = categories.findIndex(c => c.id === swapWith.id);
    const newCats = [...categories];
    [newCats[i1], newCats[i2]] = [newCats[i2], newCats[i1]];
    onUpdateCategories(newCats);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || 'Folder');
    setEditPassword(cat.password || '');
    setEditParentId(cat.parentId || '');
    setMergingCatId(null);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    const newCats = categories.map(c => c.id === editingId ? { 
        ...c, 
        name: editName.trim(),
        icon: editIcon.trim(),
        password: editPassword.trim() || undefined,
        parentId: editParentId || undefined
    } : c);
    onUpdateCategories(newCats);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    const newCat: Category = {
      id: Date.now().toString(),
      name: newCatName.trim(),
      icon: newCatIcon.trim() || 'Folder',
      password: newCatPassword.trim() || undefined,
      parentId: newCatParentId || undefined
    };
    onUpdateCategories([...categories, newCat]);
    setNewCatName('');
    setNewCatIcon('Folder');
    setNewCatPassword('');
    setNewCatParentId('');
  };

  const openMerge = (catId: string) => {
      setMergingCatId(catId);
      const excluded = new Set([catId, ...Array.from((function*(){ 
        const collect = (pid: string): string[] => getChildCategories(categories, pid).flatMap(c => [c.id, ...collect(c.id)]);
        return collect(catId);
      })())]);
      const firstTarget = categories.find(c => !excluded.has(c.id));
      if (firstTarget) setTargetMergeId(firstTarget.id);
  };

  const executeMerge = () => {
      if (!mergingCatId || !targetMergeId) return;
      if (mergingCatId === targetMergeId) return;
      if (isDescendant(categories, mergingCatId, targetMergeId)) return;
      if (!confirm('确定合并吗？合并后原分类将被删除，其子分类与链接都将移入目标分类。')) return;

      const newLinks = links.map(l => l.categoryId === mergingCatId ? { ...l, categoryId: targetMergeId } : l);
      const newCats = categories
        .filter(c => c.id !== mergingCatId)
        .map(c => c.parentId === mergingCatId ? { ...c, parentId: targetMergeId } : c);

      onUpdateCategories(newCats, newLinks);
      setMergingCatId(null);
  };

  const parentOptionsForEdit = (cat: Category) =>
    categories.filter(c => c.id !== cat.id && !isDescendant(categories, cat.id, c.id));

  const renderCatRow = (cat: Category, depth: number): React.ReactNode => {
    const children = getChildCategories(categories, cat.id);
    const siblings = categories.filter(c => (c.parentId || '') === (cat.parentId || ''));
    const idx = siblings.findIndex(c => c.id === cat.id);
    const isEditing = editingId === cat.id;
    const isMerging = mergingCatId === cat.id;
    const isDragOver = dragOverCatId === cat.id;
    const isDragging = dragCatId === cat.id;

    return (
      <div key={cat.id} className="space-y-1">
        <div 
          draggable={!isEditing && !isMerging}
          onDragStart={(e) => handleCatDragStart(e, cat)}
          onDragOver={(e) => handleCatDragOverRow(e, cat)}
          onDragLeave={() => { if (dragOverCatId === cat.id) setDragOverCatId(null); }}
          onDrop={(e) => handleCatDropRow(e, cat)}
          onDragEnd={clearDrag}
          className={`flex flex-col p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg group gap-2 border border-slate-100 dark:border-slate-600 ${
            isDragOver ? 'ring-2 ring-blue-400 border-transparent' : ''
          } ${isDragging ? 'opacity-40' : ''}`}
          style={{ marginLeft: depth * 16 }}
        >
          <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1 mr-2">
                <button 
                  onClick={() => handleMove(cat, 'up')}
                  disabled={idx === 0}
                  className="p-0.5 text-slate-400 hover:text-blue-500 disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button 
                  onClick={() => handleMove(cat, 'down')}
                  disabled={idx === siblings.length - 1}
                  className="p-0.5 text-slate-400 hover:text-blue-500 disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                          <div className="relative w-32 shrink-0">
                            <select
                                value={editIcon}
                                onChange={(e) => setEditIcon(e.target.value)}
                                className="w-full p-1.5 text-sm rounded border border-blue-500 dark:bg-slate-800 dark:text-white outline-none appearance-none"
                            >
                                {COMMON_ICONS.map(icon => (
                                    <option key={icon.value} value={icon.value}>
                                        {icon.label}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                <Icon name={editIcon} size={14} />
                            </div>
                          </div>
                          <input 
                            type="text" 
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 p-1.5 px-2 text-sm rounded border border-blue-500 dark:bg-slate-800 dark:text-white outline-none"
                            placeholder="分类名称"
                            autoFocus
                          />
                      </div>
                      <div className="flex items-center gap-2">
                          <CornerDownRight size={14} className="text-slate-400 shrink-0" />
                          <select
                            value={editParentId}
                            onChange={(e) => setEditParentId(e.target.value)}
                            className="flex-1 p-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none"
                          >
                            <option value="">顶级分类</option>
                            {parentOptionsForEdit(cat).map(c => (
                              <option key={c.id} value={c.id}>{getCategoryPath(categories, c)}</option>
                            ))}
                          </select>
                      </div>
                      <div className="flex items-center gap-2">
                          <Lock size={14} className="text-slate-400" />
                          <input 
                            type="text" 
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="flex-1 p-1.5 px-2 text-xs rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none"
                            placeholder="设置密码 (留空则不加密)"
                          />
                      </div>
                  </div>
                ) : isMerging ? (
                    <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                        <span className="text-sm dark:text-slate-200 whitespace-nowrap">合并到 &rarr;</span>
                        <select 
                            value={targetMergeId}
                            onChange={(e) => setTargetMergeId(e.target.value)}
                            className="flex-1 text-sm p-1 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        >
                            {categories
                              .filter(c => c.id !== cat.id && !isDescendant(categories, cat.id, c.id))
                              .map(c => (
                                <option key={c.id} value={c.id}>{getCategoryPath(categories, c)}</option>
                              ))}
                        </select>
                        <button onClick={executeMerge} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">确认</button>
                        <button onClick={() => setMergingCatId(null)} className="text-xs text-slate-500 px-2 py-1">取消</button>
                    </div>
                ) : (
                  <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 cursor-grab active:cursor-grabbing shrink-0">
                         {cat.icon && cat.icon.length <= 4 && !/^[a-zA-Z]+$/.test(cat.icon) 
                            ? <span className="text-lg">{cat.icon}</span> 
                            : <Icon name={cat.icon} size={16} />
                         }
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            {depth > 0 && <CornerDownRight size={12} className="text-slate-400 shrink-0" />}
                            <span className="font-medium dark:text-slate-200 truncate">{cat.name}</span>
                            {cat.password && <Lock size={12} className="text-amber-500 shrink-0" />}
                        </div>
                        <span className="text-xs text-slate-400">
                          {links.filter(l => l.categoryId === cat.id).length} 个链接
                          {children.length > 0 && ` · ${children.length} 个子分类`}
                        </span>
                      </div>
                  </div>
                )}
              </div>

              {!isEditing && !isMerging && (
                  <div className="flex items-center gap-1 self-start mt-2 shrink-0">
                    <button 
                      onClick={() => { setNewCatParentId(cat.id); setNewCatName(''); }}
                      className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                      title="添加子分类"
                    >
                        <Plus size={14} />
                    </button>
                    <button onClick={() => startEdit(cat)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded" title="编辑">
                        <Edit2 size={14} />
                    </button>
                    <button onClick={() => openMerge(cat.id)} className="p-1.5 text-slate-400 hover:text-purple-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded" title="合并到其他分类">
                        <Merge size={14} />
                    </button>
                    <button 
                      onClick={() => { if(confirm(`确定删除"${cat.name}"分类吗？\n· 其链接将移动到上级分类（无上级则移到"常用推荐"）\n· 子分类将提升到上级分类`)) onDeleteCategory(cat.id); }}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
              )}
              {isEditing && (
                   <button onClick={saveEdit} className="self-start mt-2 text-green-500 hover:bg-green-50 dark:hover:bg-slate-600 p-1.5 rounded bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-600"><Check size={16}/></button>
              )}
          </div>
        </div>
        {children.map(child => renderCatRow(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-semibold dark:text-white">分类管理</h3>
            <p className="text-xs text-slate-400 mt-0.5">支持无限层级：拖拽分类到另一分类上即可嵌套为子分类</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        <div 
          className="flex-1 overflow-y-auto p-4 space-y-2"
          onDragOver={handleCatDragOverRoot}
          onDrop={handleCatDropRoot}
        >
          {dragCatId && (
            <div className={`text-center py-2 text-xs rounded-lg border border-dashed transition-colors ${
              dragOverRoot 
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-500' 
                : 'border-slate-200 dark:border-slate-600 text-slate-400'
            }`}>
              拖到此处设为顶级分类
            </div>
          )}
          {rootCats.map(cat => renderCatRow(cat, 0))}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
           <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">
             添加新分类{newCatParentId ? `（将添加为「${getCategoryPath(categories, categories.find(c => c.id === newCatParentId)!)}」的子分类）` : ''}
           </label>
           <div className="flex flex-col gap-2">
             <div className="flex gap-2">
                 <div className="relative w-32 shrink-0">
                    <select
                        value={newCatIcon}
                        onChange={(e) => setNewCatIcon(e.target.value)}
                        className="w-full p-2 pl-2 pr-8 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm outline-none appearance-none"
                    >
                        {COMMON_ICONS.map(icon => (
                            <option key={icon.value} value={icon.value}>
                                {icon.label}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <Icon name={newCatIcon} size={16} />
                    </div>
                 </div>
                 
                 <input 
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="分类名称"
                    className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                 />
             </div>
             <div className="flex gap-2">
                 <select
                    value={newCatParentId}
                    onChange={(e) => setNewCatParentId(e.target.value)}
                    className="w-48 shrink-0 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm outline-none"
                 >
                    <option value="">顶级分类</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{getCategoryPath(categories, c)}</option>
                    ))}
                 </select>
                 <div className="flex-1 relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text"
                        value={newCatPassword}
                        onChange={(e) => setNewCatPassword(e.target.value)}
                        placeholder="密码 (可选)"
                        className="w-full pl-8 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                 </div>
                 <button 
                    onClick={handleAdd}
                    disabled={!newCatName.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                 >
                   <Plus size={18} />
                 </button>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagerModal;
