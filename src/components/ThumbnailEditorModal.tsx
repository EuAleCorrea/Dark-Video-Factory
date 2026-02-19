import React, { useEffect, useRef, useState } from 'react';
import { X, Save, Type, RotateCcw, Move, Trash2, Download, Layers, LayoutTemplate, Image as ImageIcon } from 'lucide-react';
import * as fabric from 'fabric';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { GeneratedImage } from '../types/images';

interface ThumbnailEditorModalProps {
    image: GeneratedImage;
    onClose: () => void;
    onSave: (newImageBlob: Blob) => void;
}

const FONTS = [
    // Sans Serif
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Raleway', 'Nunito', 'Poppins',
    'Ubuntu', 'Source Sans 3', 'PT Sans', 'Quicksand', 'Work Sans', 'Fira Sans', 'Barlow', 'Mulish',
    'Titillium Web', 'Rubik', 'Kanit', 'Exo 2', 'Josefin Sans',
    // Serif
    'Merriweather', 'Playfair Display', 'Roboto Slab', 'Lora', 'PT Serif', 'Bitter', 'Arvo',
    // Display / Impact
    'Bebas Neue', 'Anton', 'Bangers', 'Abril Fatface', 'Righteous', 'Fredoka',
    // Handwriting / Script
    'Pacifico', 'Lobster', 'Permanent Marker', 'Dancing Script',
    // Monospace
    'Courier New', 'Roboto Mono', 'Space Mono'
].sort();

// Base fonts loaded immediately (most used)
const BASE_FONTS = ['Inter', 'Roboto', 'Montserrat', 'Bebas Neue', 'Courier New'];

// Track which fonts have been loaded to avoid duplicate <link> tags
const loadedFonts = new Set<string>(BASE_FONTS);

/** Load a Google Font on demand by inserting a <link> tag */
const loadFont = (family: string) => {
    if (loadedFonts.has(family) || family === 'Courier New') return;
    loadedFonts.add(family);
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
};

/** Load all fonts at once (called when font dropdown opens) */
const loadAllFonts = () => {
    FONTS.forEach(loadFont);
};

// Import types from fabric
type TOriginX = fabric.TOriginX;
type TOriginY = fabric.TOriginY;
type TextAlign = fabric.ITextProps['textAlign'];

interface ThumbnailTemplate {
    id: string;
    label: string;
    description?: string;
    custom?: boolean;
    objects: Array<{
        type: 'text';
        text: string;
        left: number; // Percentual 0-1 (relative to canvas width)
        top: number;  // Percentual 0-1 (relative to canvas height)
        fontSize: number;
        fontFamily: string;
        fill: string;
        stroke: string;
        strokeWidth: number;
        originX: TOriginX;
        originY: TOriginY;
        textAlign?: TextAlign;
    }>;
}

const TEMPLATES: ThumbnailTemplate[] = [
    {
        id: '3-lines-yellow',
        label: '3 Linhas Amarelas',
        description: 'Texto à esquerda, Courier New, Amarelo',
        objects: [
            {
                type: 'text',
                text: 'MATADORA',
                left: 0.05,
                top: 0.2,
                fontSize: 80,
                fontFamily: 'Courier New',
                fill: '#FACC15', // Yellow-400
                stroke: '#000000',
                strokeWidth: 2,
                originX: 'left',
                originY: 'center',
                textAlign: 'left'
            },
            {
                type: 'text',
                text: 'HEADLINE',
                left: 0.05,
                top: 0.4,
                fontSize: 80,
                fontFamily: 'Courier New',
                fill: '#FACC15',
                stroke: '#000000',
                strokeWidth: 2,
                originX: 'left',
                originY: 'center',
                textAlign: 'left'
            },
            {
                type: 'text',
                text: 'AQUI',
                left: 0.05,
                top: 0.6,
                fontSize: 80,
                fontFamily: 'Courier New',
                fill: '#FACC15',
                stroke: '#000000',
                strokeWidth: 2,
                originX: 'left',
                originY: 'center',
                textAlign: 'left'
            }
        ]
    }
];

export const ThumbnailEditorModal: React.FC<ThumbnailEditorModalProps> = ({ image, onClose, onSave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
    const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);

    // Controles de Texto
    const [textInput, setTextInput] = useState('');
    const [fontFamily, setFontFamily] = useState('Roboto');
    const [isFontListOpen, setIsFontListOpen] = useState(false); // State for custom dropdown
    const [textColor, setTextColor] = useState('#ffffff');
    const [strokeColor, setStrokeColor] = useState('#000000');
    const [strokeWidth, setStrokeWidth] = useState(0);

    // Load templates from local storage or use default
    const [availableTemplates, setAvailableTemplates] = useState<ThumbnailTemplate[]>(TEMPLATES);

    useEffect(() => {
        const saved = localStorage.getItem('thumbnail_templates');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge saved templates with default ones (avoiding duplicates if logic requires)
                // For now, let's just append user templates to the default list or replace if we want full persistence of defaults too
                // Better strategy: Keep defaults constant, apppend custom ones.
                const customTemplates = parsed.filter((t: ThumbnailTemplate) => t.custom);
                setAvailableTemplates([...TEMPLATES, ...customTemplates]);
            } catch (e) {
                console.error("Failed to load templates", e);
            }
        }
    }, []);

    const saveCustomTemplate = () => {
        if (!fabricCanvas) return;
        const name = prompt("Nome do Modelo:");
        if (!name) return;

        const objects = fabricCanvas.getObjects().filter(o => o instanceof fabric.IText) as fabric.IText[];
        const width = fabricCanvas.width || 800;
        const height = fabricCanvas.height || 600;

        const newTemplate: ThumbnailTemplate = {
            id: `custom-${Date.now()}`,
            label: name,
            description: 'Modelo Personalizado',
            custom: true,
            objects: objects.map(obj => ({
                type: 'text',
                text: obj.text || '',
                left: (obj.left || 0) / width,
                top: (obj.top || 0) / height,
                fontSize: obj.fontSize || 40,
                fontFamily: obj.fontFamily || 'Roboto',
                fill: obj.fill as string,
                stroke: obj.stroke as string,
                strokeWidth: obj.strokeWidth || 0,
                originX: obj.originX || 'left',
                originY: obj.originY || 'top',
                textAlign: obj.textAlign
            }))
        };

        const updatedTemplates = [...availableTemplates, newTemplate];
        setAvailableTemplates(updatedTemplates);
        localStorage.setItem('thumbnail_templates', JSON.stringify(updatedTemplates));
    };

    const deleteTemplate = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Excluir este modelo?")) {
            const updated = availableTemplates.filter(t => t.id !== id);
            setAvailableTemplates(updated);
            localStorage.setItem('thumbnail_templates', JSON.stringify(updated));
        }
    };

    const [shadowColor, setShadowColor] = useState("#000000");
    const [shadowBlur, setShadowBlur] = useState(0);

    // Inicializar Canvas
    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        const canvas = new fabric.Canvas(canvasRef.current, {
            backgroundColor: '#1e1e1e',
            selection: true
        });

        // Setup inicial do tamanho - ajustaremos quando a imagem carregar
        canvas.setDimensions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight
        });

        setFabricCanvas(canvas);

        return () => {
            canvas.dispose();
        };
    }, []);

    const loadCanvasImage = (url: string) => {
        if (!fabricCanvas) return;

        const options = url.startsWith('asset://') ? {} : { crossOrigin: 'anonymous' as const };
        fabric.Image.fromURL(url, options).then((img: fabric.Image) => {
            if (!img) return;

            // Ajustar canvas para proporção da imagem, mas cabendo na tela
            const containerWidth = containerRef.current?.clientWidth || 800;
            const containerHeight = containerRef.current?.clientHeight || 600;

            const scale = Math.min(
                containerWidth / (img.width || 1),
                containerHeight / (img.height || 1)
            ) * 0.9; // 90% do espaço

            const finalWidth = (img.width || 1) * scale;
            const finalHeight = (img.height || 1) * scale;

            fabricCanvas.setDimensions({
                width: finalWidth,
                height: finalHeight
            });

            img.scale(scale);

            // Centralizar
            fabricCanvas.centerObject(img);
            fabricCanvas.backgroundImage = img;
            fabricCanvas.renderAll();
        }).catch(err => {
            console.error("Erro ao carregar imagem no canvas:", err);
        });
    };

    // Initial Load
    useEffect(() => {
        if (image.url) {
            loadCanvasImage(image.url);
        }
    }, [fabricCanvas, image.url]); // Depend on image.url changes too if initial prop changes

    // Event Listeners
    // ... rest of listeners setup code moved here logic-wise from previous effect ...
    // But since we split initialization, this is fine.
    // The previous useEffect block for image loading is replaced by this function + useEffect.

    // To avoid duplication with the existing useEffect block 229-272:
    // I should actually MODIFY that block to use the helper function.
    // But since I can't see the exact lines in my context window perfectly (I viewed lines 1-300),
    // and lines 229-272 were where the image loading logic was.
    // I will REPLACE lines 229-272 with the new logic.

    // Setup Fabric.js selection event listeners and update state
    useEffect(() => {
        const updateTextInputs = (e: any) => {
            const activeObj = e.selected?.[0];
            if (activeObj && activeObj instanceof fabric.IText) {
                // @ts-ignore - accessing text property safely
                setTextInput(activeObj.text || '');
                // @ts-ignore
                setFontFamily(activeObj.fontFamily || 'Roboto');
                // @ts-ignore
                setTextColor(activeObj.fill as string || '#ffffff');
                // @ts-ignore
                setStrokeColor(activeObj.stroke as string || '#000000');
                // @ts-ignore
                setStrokeWidth(activeObj.strokeWidth || 0);
                setSelectedObject(activeObj);
            } else {
                setSelectedObject(null);
            }
        };

        if (fabricCanvas) {
            fabricCanvas.on('selection:created', updateTextInputs);
            fabricCanvas.on('selection:updated', updateTextInputs);
            fabricCanvas.on('selection:cleared', () => setSelectedObject(null));

            // Magnetic Alignment (Snapping & Smart Guides)
            const SNAP_THRESHOLD = 10;
            const CANVAS_GUIDE_COLOR = '#FACC15'; // Yellow-400 (Canvas Center)
            const OBJECT_GUIDE_COLOR = '#EF4444'; // Red-500 (Object to Object)

            let guidelines: fabric.Line[] = [];

            const clearGuidelines = () => {
                guidelines.forEach(line => fabricCanvas.remove(line));
                guidelines = [];
                fabricCanvas.requestRenderAll();
            };

            const drawGuide = (x1: number, y1: number, x2: number, y2: number, color: string) => {
                const line = new fabric.Line([x1, y1, x2, y2], {
                    stroke: color,
                    strokeWidth: 1,
                    strokeDashArray: [5, 5],
                    selectable: false,
                    evented: false,
                    opacity: 0.8
                });
                fabricCanvas.add(line);
                guidelines.push(line);
            };

            fabricCanvas.on('object:moving', (e) => {
                const activeObj = e.target;
                if (!activeObj || !fabricCanvas.width || !fabricCanvas.height) return;

                clearGuidelines();

                const canvasWidth = fabricCanvas.width;
                const canvasHeight = fabricCanvas.height;
                const canvasCenterX = canvasWidth / 2;
                const canvasCenterY = canvasHeight / 2;

                // 1. Get Active Object Coordinates (cached for performance)
                const activeRect = activeObj.getBoundingRect();
                const activeLeft = activeRect.left;
                const activeRight = activeLeft + activeRect.width;
                const activeTop = activeRect.top;
                const activeBottom = activeTop + activeRect.height;
                const activeCenterX = activeLeft + (activeRect.width / 2);
                const activeCenterY = activeTop + (activeRect.height / 2);

                let snappedX = false;
                let snappedY = false;

                // --- CANVAS CENTER SNAPPING ---

                // Horizontal Center (Vertical Line)
                if (Math.abs(activeCenterX - canvasCenterX) < SNAP_THRESHOLD) {
                    const dx = canvasCenterX - activeCenterX;
                    activeObj.set({ left: activeObj.left! + dx });
                    drawGuide(canvasCenterX, 0, canvasCenterX, canvasHeight, CANVAS_GUIDE_COLOR);
                    snappedX = true;
                }

                // Vertical Center (Horizontal Line)
                if (Math.abs(activeCenterY - canvasCenterY) < SNAP_THRESHOLD) {
                    const dy = canvasCenterY - activeCenterY;
                    activeObj.set({ top: activeObj.top! + dy });
                    drawGuide(0, canvasCenterY, canvasWidth, canvasCenterY, CANVAS_GUIDE_COLOR);
                    snappedY = true;
                }

                // --- OBJECT TO OBJECT SNAPPING (If not snapped to canvas center) ---
                if (!snappedX || !snappedY) {
                    const otherObjects = fabricCanvas.getObjects().filter(o => o !== activeObj && o instanceof fabric.IText); // Snap only to text for now to avoid bg noise

                    for (const target of otherObjects) {
                        if (snappedX && snappedY) break; // Optimization

                        const targetRect = target.getBoundingRect();
                        const targetLeft = targetRect.left;
                        const targetRight = targetLeft + targetRect.width;
                        const targetTop = targetRect.top;
                        const targetBottom = targetTop + targetRect.height;
                        const targetCenterX = targetLeft + (targetRect.width / 2);
                        const targetCenterY = targetTop + (targetRect.height / 2);

                        // Vertical Alignment (Horizontal Movement checks)
                        if (!snappedX) {
                            // Left to Left
                            if (Math.abs(activeLeft - targetLeft) < SNAP_THRESHOLD) {
                                const dx = targetLeft - activeLeft;
                                activeObj.set({ left: activeObj.left! + dx });
                                drawGuide(targetLeft, Math.min(activeTop, targetTop) - 50, targetLeft, Math.max(activeBottom, targetBottom) + 50, OBJECT_GUIDE_COLOR);
                                snappedX = true;
                            }
                            // Right to Right
                            else if (Math.abs(activeRight - targetRight) < SNAP_THRESHOLD) {
                                const dx = targetRight - activeRight;
                                activeObj.set({ left: activeObj.left! + dx });
                                drawGuide(targetRight, Math.min(activeTop, targetTop) - 50, targetRight, Math.max(activeBottom, targetBottom) + 50, OBJECT_GUIDE_COLOR);
                                snappedX = true;
                            }
                            // Center to Center (Vertical)
                            else if (Math.abs(activeCenterX - targetCenterX) < SNAP_THRESHOLD) {
                                const dx = targetCenterX - activeCenterX;
                                activeObj.set({ left: activeObj.left! + dx });
                                drawGuide(targetCenterX, Math.min(activeTop, targetTop) - 50, targetCenterX, Math.max(activeBottom, targetBottom) + 50, OBJECT_GUIDE_COLOR);
                                snappedX = true;
                            }
                            // Left to Right
                            else if (Math.abs(activeLeft - targetRight) < SNAP_THRESHOLD) {
                                const dx = targetRight - activeLeft;
                                activeObj.set({ left: activeObj.left! + dx });
                                drawGuide(targetRight, Math.min(activeTop, targetTop) - 50, targetRight, Math.max(activeBottom, targetBottom) + 50, OBJECT_GUIDE_COLOR);
                                snappedX = true;
                            }
                            // Right to Left
                            else if (Math.abs(activeRight - targetLeft) < SNAP_THRESHOLD) {
                                const dx = targetLeft - activeRight;
                                activeObj.set({ left: activeObj.left! + dx });
                                drawGuide(targetLeft, Math.min(activeTop, targetTop) - 50, targetLeft, Math.max(activeBottom, targetBottom) + 50, OBJECT_GUIDE_COLOR);
                                snappedX = true;
                            }
                        }

                        // Horizontal Alignment (Vertical Movement checks)
                        if (!snappedY) {
                            // Top to Top
                            if (Math.abs(activeTop - targetTop) < SNAP_THRESHOLD) {
                                const dy = targetTop - activeTop;
                                activeObj.set({ top: activeObj.top! + dy });
                                drawGuide(Math.min(activeLeft, targetLeft) - 50, targetTop, Math.max(activeRight, targetRight) + 50, targetTop, OBJECT_GUIDE_COLOR);
                                snappedY = true;
                            }
                            // Bottom to Bottom
                            else if (Math.abs(activeBottom - targetBottom) < SNAP_THRESHOLD) {
                                const dy = targetBottom - activeBottom;
                                activeObj.set({ top: activeObj.top! + dy });
                                drawGuide(Math.min(activeLeft, targetLeft) - 50, targetBottom, Math.max(activeRight, targetRight) + 50, targetBottom, OBJECT_GUIDE_COLOR);
                                snappedY = true;
                            }
                            // Center to Center (Horizontal)
                            else if (Math.abs(activeCenterY - targetCenterY) < SNAP_THRESHOLD) {
                                const dy = targetCenterY - activeCenterY;
                                activeObj.set({ top: activeObj.top! + dy });
                                drawGuide(Math.min(activeLeft, targetLeft) - 50, targetCenterY, Math.max(activeRight, targetRight) + 50, targetCenterY, OBJECT_GUIDE_COLOR);
                                snappedY = true;
                            }
                            // Top to Bottom
                            else if (Math.abs(activeTop - targetBottom) < SNAP_THRESHOLD) {
                                const dy = targetBottom - activeTop;
                                activeObj.set({ top: activeObj.top! + dy });
                                drawGuide(Math.min(activeLeft, targetLeft) - 50, targetBottom, Math.max(activeRight, targetRight) + 50, targetBottom, OBJECT_GUIDE_COLOR);
                                snappedY = true;
                            }
                            // Bottom to Top
                            else if (Math.abs(activeBottom - targetTop) < SNAP_THRESHOLD) {
                                const dy = targetTop - activeBottom;
                                activeObj.set({ top: activeObj.top! + dy });
                                drawGuide(Math.min(activeLeft, targetLeft) - 50, targetTop, Math.max(activeRight, targetRight) + 50, targetTop, OBJECT_GUIDE_COLOR);
                                snappedY = true;
                            }
                        }
                    }
                }
            });

            fabricCanvas.on('object:modified', clearGuidelines);
            // Also clear on mouse up just in case
            fabricCanvas.on('mouse:up', clearGuidelines);
        }

        return () => {
            if (fabricCanvas) {
                fabricCanvas.off('selection:created', updateTextInputs);
                fabricCanvas.off('selection:updated', updateTextInputs);
                fabricCanvas.off('selection:cleared');
                // Guidelines listeners will be removed when proper off logic implementation or canvas dispose
                // Ideally we should name functions to off them specifically, but disposal cleans all.
            }
        };
    }, [fabricCanvas]);

    // Handle Delete Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (!fabricCanvas) return;
                const activeObj = fabricCanvas.getActiveObject();
                // Check if we are currently editing a text object (entering text)
                // @ts-ignore - isEditing property check
                const isEditing = activeObj?.isEditing;

                if (activeObj && !isEditing) {
                    deleteSelected();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fabricCanvas, selectedObject]); // Re-bind if canvas or selection changes (though deleteSelected uses closure scope relies on fabricCanvas state)

    // Atualizar inputs quando objeto selecionado mudar
    useEffect(() => {
        if (!selectedObject || !(selectedObject instanceof fabric.IText)) return;
        const textObj = selectedObject as fabric.IText;

        setTextInput(textObj.text || "");
        setFontFamily(textObj.fontFamily || "Roboto");
        setTextColor(textObj.fill as string || "#ffffff");
        setStrokeColor(textObj.stroke as string || "#000000");
        setStrokeWidth(textObj.strokeWidth || 0);
        // Shadow handling in fabric is complex (can be object or string)
    }, [selectedObject]);


    // Handlers
    const addText = () => {
        if (!fabricCanvas) return;

        const text = new fabric.IText('Novo Texto', {
            left: fabricCanvas.width! / 2,
            top: fabricCanvas.height! / 2,
            fontFamily: 'Roboto',
            fill: '#ffffff',
            fontSize: 60,
            originX: 'center',
            originY: 'center',
            stroke: '#000000',
            strokeWidth: 0
        });

        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        fabricCanvas.renderAll();
    };

    const applyTemplate = (template: ThumbnailTemplate) => {
        if (!fabricCanvas) return;

        // Opcional: Limpar objetos existentes antes (exceto background)
        // fabricCanvas.clear();
        // Mas 'clear' remove background image também se não tomar cuidado.
        // Melhor remover apenas objetos de texto:
        const objects = fabricCanvas.getObjects();
        objects.forEach(obj => {
            if (obj instanceof fabric.IText) {
                fabricCanvas.remove(obj);
            }
        });

        const width = fabricCanvas.width || 800;
        const height = fabricCanvas.height || 600;

        template.objects.forEach(objDef => {
            const text = new fabric.IText(objDef.text, {
                left: objDef.left * width,
                top: objDef.top * height,
                fontFamily: objDef.fontFamily,
                fill: objDef.fill,
                fontSize: objDef.fontSize, // Pode precisar escalar baseado no tamanho do canvas
                stroke: objDef.stroke,
                strokeWidth: objDef.strokeWidth,
                originX: objDef.originX,
                originY: objDef.originY,
                textAlign: objDef.textAlign
            });
            fabricCanvas.add(text);
        });

        fabricCanvas.renderAll();
        // Selecionar o primeiro objeto pra facilitar edição
        const firstObj = fabricCanvas.getObjects().find(o => o instanceof fabric.IText);
        if (firstObj) {
            fabricCanvas.setActiveObject(firstObj);
        }
    };

    const updateSelected = (imgObj: Partial<fabric.IText>) => {
        if (!fabricCanvas || !selectedObject) return;
        selectedObject.set(imgObj);
        fabricCanvas.renderAll();
    };

    const deleteSelected = () => {
        if (!fabricCanvas || !selectedObject) return;
        fabricCanvas.remove(selectedObject);
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
    };

    const handleSaveCanvas = async () => {
        if (!fabricCanvas) return;

        // Deselecionar tudo para não salvar bordas de seleção
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();

        const dataURL = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 1 // Pode aumentar para alta resolução se a imagem original for maior que o canvas visualizado
        });

        // Converter DataURL para Blob
        const res = await fetch(dataURL);
        const blob = await res.blob();

        onSave(blob);
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#0f172a] flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#1e293b]">
                <h2 className="text-white font-bold flex items-center gap-2">
                    <span className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                        <Type size={18} />
                    </span>
                    Editor de Thumbnail
                </h2>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSaveCanvas}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold flex items-center gap-2 transition-transform active:scale-95"
                    >
                        <Save size={18} />
                        Salvar Nova
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Canvas Area */}
                <div
                    ref={containerRef}
                    className="flex-1 bg-[#020617] relative flex items-center justify-center p-8 overflow-hidden w-full h-full"
                >
                    <canvas ref={canvasRef} />
                </div>

                {/* Sidebar Controls */}
                <div className="w-80 bg-[#1e293b] border-l border-slate-800 flex flex-col overflow-y-auto custom-scrollbar">

                    <div className="p-6 border-b border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                <LayoutTemplate size={14} /> Modelos Rapidos
                            </h3>
                            <button onClick={saveCustomTemplate} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider">
                                + Salvar Atual
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {availableTemplates.map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => applyTemplate(template)}
                                    className="relative p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-left transition-colors group"
                                >
                                    <div className="text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">{template.label}</div>
                                    <div className="text-[10px] text-slate-500">{template.description}</div>
                                    {/* @ts-ignore */}
                                    {template.custom && (
                                        <div
                                            onClick={(e) => deleteTemplate(template.id, e)}
                                            className="absolute top-2 right-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 border-b border-slate-800">
                        <button
                            onClick={addText}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/20"
                        >
                            <Type size={18} />
                            Adicionar Texto
                        </button>
                    </div>

                    {selectedObject && (selectedObject instanceof fabric.IText) ? (
                        <div className="p-6 space-y-6">

                            {/* Conteúdo */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Texto</label>
                                <textarea
                                    value={textInput}
                                    onChange={(e) => {
                                        setTextInput(e.target.value);
                                        updateSelected({ text: e.target.value });
                                    }}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-emerald-500 outline-none resize-none h-20"
                                />
                            </div>

                            {/* Fonte */}
                            <div className="space-y-2 relative">
                                <label className="text-xs font-bold text-slate-400 uppercase">Fonte</label>
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            if (!isFontListOpen) loadAllFonts();
                                            setIsFontListOpen(!isFontListOpen);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 text-left flex items-center justify-between"
                                        style={{ fontFamily: fontFamily }}
                                    >
                                        {fontFamily}
                                        <span className="text-slate-500 text-[10px]">▼</span>
                                    </button>

                                    {isFontListOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50 custom-scrollbar">
                                            {FONTS.map(font => (
                                                <div
                                                    key={font}
                                                    onClick={() => {
                                                        updateSelected({ fontFamily: font });
                                                        setFontFamily(font);
                                                        setIsFontListOpen(false);
                                                    }}
                                                    onMouseEnter={() => {
                                                        updateSelected({ fontFamily: font });
                                                    }}
                                                    onMouseLeave={() => {
                                                        if (fontFamily) {
                                                            updateSelected({ fontFamily: fontFamily });
                                                        }
                                                    }}
                                                    className={`px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 cursor-pointer flex items-center justify-between ${font === fontFamily ? 'bg-slate-700 text-emerald-400' : ''}`}
                                                    style={{ fontFamily: font }}
                                                >
                                                    {font}
                                                    {font === fontFamily && <span className="text-emerald-400">✓</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Cores */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Cor do Texto</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={textColor}
                                            onChange={(e) => {
                                                setTextColor(e.target.value);
                                                updateSelected({ fill: e.target.value });
                                            }}
                                            className="w-10 h-10 rounded cursor-pointer bg-transparent border-none"
                                        />
                                        <span className="text-slate-300 text-sm">{textColor}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase flex justify-between">
                                        <span>Contorno</span>
                                        <span className="text-slate-500">{strokeWidth}px</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10"
                                        step="0.5"
                                        value={strokeWidth}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setStrokeWidth(val);
                                            updateSelected({ strokeWidth: val });
                                        }}
                                        className="w-full accent-emerald-500"
                                    />
                                    {strokeWidth > 0 && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <input
                                                type="color"
                                                value={strokeColor}
                                                onChange={(e) => {
                                                    setStrokeColor(e.target.value);
                                                    updateSelected({ stroke: e.target.value });
                                                }}
                                                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                                            />
                                            <span className="text-slate-400 text-xs">Cor do Contorno</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-6 border-t border-slate-800 flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => {
                                            if (fabricCanvas && selectedObject) {
                                                fabricCanvas.moveObjectTo(selectedObject, fabricCanvas.getObjects().length - 1);
                                                fabricCanvas.renderAll();
                                            }
                                        }}
                                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-xs flex items-center justify-center gap-2"
                                    >
                                        <Layers size={14} /> Trazer p/ Frente
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (fabricCanvas && selectedObject) {
                                                fabricCanvas.moveObjectTo(selectedObject, 0);
                                                fabricCanvas.renderAll();
                                            }
                                        }}
                                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-xs flex items-center justify-center gap-2"
                                    >
                                        <Layers size={14} /> Enviar p/ Trás
                                    </button>
                                </div>

                                <button
                                    onClick={deleteSelected}
                                    className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Trash2 size={16} />
                                    Remover Objeto
                                </button>
                            </div>

                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                            <Move size={48} className="mb-4 opacity-20" />
                            <p className="text-sm">Selecione um objeto no canvas para editar suas propriedades.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Base Fonts Loader — only 5 essential fonts loaded upfront */}
            <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;700&family=Montserrat:wght@400;700&family=Roboto:wght@400;700&display=swap');`}
            </style>
        </div>
    );
};
