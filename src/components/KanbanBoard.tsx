import React from 'react';
import { VideoProject, PipelineStage, PIPELINE_STAGES_ORDER, STAGE_META } from '../types';
import { DragDropContext } from '@hello-pangea/dnd';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
    projects: VideoProject[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onProjectClick: (project: VideoProject) => void;
    onDeleteProject: (id: string) => void;
    onStageClick?: (project: VideoProject, stage: PipelineStage) => void;
    onViewError?: (project: VideoProject) => void;
}

export default function KanbanBoard({ projects, selectedIds, onToggleSelect, onProjectClick, onDeleteProject, onStageClick, onViewError, onDragEnd }: KanbanBoardProps & { onDragEnd: (result: any) => void }) {
    const projectsByStage = (stage: PipelineStage): VideoProject[] => {
        return projects.filter(p => p.currentStage === stage);
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex gap-3 h-full p-4 min-w-max">
                    {PIPELINE_STAGES_ORDER.map((stage) => {
                        const stageProjects = projectsByStage(stage);
                        const meta = STAGE_META[stage];
                        return (
                            <KanbanColumn
                                key={stage}
                                stage={stage}
                                meta={meta}
                                projects={stageProjects}
                                selectedIds={selectedIds}
                                onToggleSelect={onToggleSelect}
                                onProjectClick={onProjectClick}
                                onDeleteProject={onDeleteProject}
                                onStageClick={onStageClick}
                                onViewError={onViewError}
                            />
                        );
                    })}
                </div>
            </div>
        </DragDropContext>
    );
}
