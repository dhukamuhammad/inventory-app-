"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Edit2, Trash2, Plus, Check, X } from "lucide-react";

export interface DropdownItem {
  id: string;
  name: string;
}

interface CustomDropdownProps {
  label: string;
  items: DropdownItem[];
  value: string; // The selected ID
  onChange: (id: string) => void;
  onAdd: (name: string) => Promise<any>;
  onEdit: (id: string, newName: string) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  placeholder?: string;
  required?: boolean;
}

export function CustomDropdown({
  label,
  items,
  value,
  onChange,
  onAdd,
  onEdit,
  onDelete,
  placeholder = "Select...",
  required,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addText, setAddText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
        setEditingId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAdd = async () => {
    if (!addText.trim()) return;
    await onAdd(addText.trim());
    setAddText("");
    setIsAdding(false);
  };

  const handleEdit = async (id: string) => {
    if (!editText.trim()) return;
    await onEdit(id, editText.trim());
    setEditingId(null);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this?")) {
      await onDelete(id);
      if (value === id) onChange("");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      
      {/* Hidden input for HTML form validation */}
      <input type="text" value={value} required={required} className="absolute opacity-0 w-0 h-0" onChange={() => {}} />

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-left"
      >
        <span className={selectedItem ? "text-gray-900" : "text-gray-400"}>
          {selectedItem ? selectedItem.name : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-100 max-h-60 overflow-y-auto">
          {/* Item List */}
          <ul className="py-1">
            {items.map((item) => (
              <li
                key={item.id}
                className="group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => {
                  if (editingId !== item.id) {
                    onChange(item.id);
                    setIsOpen(false);
                  }
                }}
              >
                {editingId === item.id ? (
                  <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      autoFocus
                      className="flex-1 px-2 py-1 text-sm border rounded"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleEdit(item.id)}
                    />
                    <button onClick={() => handleEdit(item.id)} className="text-emerald-600 hover:text-emerald-700"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <span className={`text-sm ${value === item.id ? "font-semibold text-blue-600" : "text-gray-700"}`}>
                      {item.name}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(item.id);
                          setEditText(item.name);
                        }}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, item.id)}
                        className="text-gray-400 hover:text-rose-600 transition-colors p-1"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          {/* Add New Section */}
          <div className="border-t border-gray-100 p-2 bg-gray-50/50">
            {isAdding ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Enter name..."
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!addText.trim()}
                  className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setAddText("");
                  }}
                  className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 w-full px-2 py-1.5 rounded hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add New {label.split(' ')[0]}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
