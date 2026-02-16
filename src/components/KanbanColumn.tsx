import React from 'react';
import { VideoProject, PipelineStage, StageMeta } from '../types';
import ProjectCard from './ProjectCard';
import { Droppable, Draggable } from '@hello-pangea/dnd';

interface KanbanColumnProps {
    stage: PipelineStage;
    meta: StageMeta;
    projects: VideoProject[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onProjectClick: (project: VideoProject) => void;
    onDeleteProject: (id: string) => void;
    onStageClick?: (project: VideoProject, stage: PipelineStage) => void;
    onViewError?: (project: VideoProject) => void;
}

export default function KanbanColumn({ stage, meta, projects, selectedIds, onToggleSelect, onProjectClick, onDeleteProject, onStageClick, onViewError }: KanbanColumnProps) {
    const count = projects.length;
    const hasProjects = count > 0;

    return (
        <div className="w-80 shrink-0 flex flex-col h-full">
            {/* Column Header */}
            <div
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-2.5"
                style={{ backgroundColor: meta.bgColor }}
            >
                <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                />
                <span className="text-base font-semibold text-[#0F172A] truncate">
                    {meta.label}
                </span>
                <span
                    className="ml-auto text-sm font-bold px-2.5 py-1 rounded-lg"
                    style={{ backgroundColor: meta.color, color: '#FFFFFF' }}
                >
                    {count}
                </span>
            </div>

            {/* Cards Container */}
            <Droppable droppableId={stage}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-50/50' : ''}`}
                    >
                        {projects.map((project, index) => (
                            <Draggable key={project.id} draggableId={project.id} index={index}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        style={{ ...provided.draggableProps.style }}
                                        className={snapshot.isDragging ? 'opacity-90 rotate-2 scale-105 z-50' : ''}
                                    >
                                        <ProjectCard
                                            project={project}
                                            stageMeta={meta}
                                            isSelected={selectedIds.has(project.id)}
                                            onToggleSelect={() => onToggleSelect(project.id)}
                                            onClick={() => onProjectClick(project)}
                                            onDelete={() => onDeleteProject(project.id)}
                                            onStageClick={onStageClick}
                                            onViewError={onViewError}
                                        />
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                        {!hasProjects && (
                            <div className="flex items-center justify-center h-24 border border-dashed border-[#E2E8F0] rounded-xl">
                                <span className="text-sm text-[#94A3B8]">Nenhum projeto</span>
                            </div>
                        )}
                    </div>
                )}
            </Droppable>
        </div>
    );
}
