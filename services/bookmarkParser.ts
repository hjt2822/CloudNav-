import { LinkItem, Category } from '../types';

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export interface ImportResult {
  links: LinkItem[];
  categories: Category[];
}

const GENERIC_FOLDERS = ['Bookmarks Bar', '书签栏', 'Other Bookmarks', '其他书签', 'Bookmarks', '书签'];

export const parseBookmarks = async (file: File): Promise<ImportResult> => {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');

  const links: LinkItem[] = [];
  const categories: Category[] = [];
  const categoryMap = new Map<string, string>();

  const getCategoryId = (name: string, parentId?: string): string => {
    if (!name || GENERIC_FOLDERS.includes(name)) {
        return parentId || 'common';
    }

    const key = parentId ? `${parentId}::${name}` : name;
    if (categoryMap.has(key)) {
      return categoryMap.get(key)!;
    }
    
    const newId = generateId();
    categories.push({
      id: newId,
      name: name,
      icon: 'Folder',
      parentId
    });
    categoryMap.set(key, newId);
    return newId;
  };

  const traverse = (element: Element, currentCategoryId: string, depth: number) => {
    const children = Array.from(element.children);
    
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      const tagName = node.tagName.toUpperCase();

      if (tagName === 'DT') {
        const h3 = node.querySelector(':scope > h3');
        const a = node.querySelector(':scope > a');
        const dl = node.querySelector(':scope > dl');

        if (h3 && dl) {
            const folderName = h3.textContent || 'Unknown';
            let nextId = currentCategoryId;
            if (GENERIC_FOLDERS.includes(folderName)) {
                nextId = currentCategoryId;
            } else if (depth === 0) {
                nextId = getCategoryId(folderName);
            } else {
                const parentId = currentCategoryId === 'common' ? undefined : currentCategoryId;
                nextId = getCategoryId(folderName, parentId);
            }
            traverse(dl, nextId, depth + 1);
        } else if (a) {
            const title = a.textContent || a.getAttribute('href') || 'No Title';
            const url = a.getAttribute('href');
            
            if (url && !url.startsWith('chrome://') && !url.startsWith('about:')) {
                links.push({
                    id: generateId(),
                    title: title,
                    url: url,
                    categoryId: currentCategoryId,
                    createdAt: Date.now(),
                    icon: a.getAttribute('icon') || undefined
                });
            }
        } else if (dl) {
            traverse(dl, currentCategoryId, depth);
        }
      } else if (tagName === 'DL') {
        traverse(node, currentCategoryId, depth);
      }
    }
  };

  const rootDl = doc.querySelector('dl');
  if (rootDl) {
    traverse(rootDl, 'common', 0);
  }

  return { links, categories };
};
