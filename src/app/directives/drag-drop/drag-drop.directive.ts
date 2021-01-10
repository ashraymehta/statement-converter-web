import { Directive, Output, EventEmitter, HostBinding, HostListener } from '@angular/core';

@Directive({
    selector: '[appDragDrop]'
})
export class DragDropDirective {

    @Output()
    public onFileDropped: EventEmitter<File[]> = new EventEmitter<File[]>();
    @Output()
    public onDragOver: EventEmitter<void> = new EventEmitter<void>();
    @Output()
    public onDragLeave: EventEmitter<void> = new EventEmitter<void>();

    @HostListener('dragover', ['$event'])
    public onDragOverInternal(event) {
        event.preventDefault();
        event.stopPropagation();
        this.onDragOver.emit();
    }

    @HostListener('dragleave', ['$event'])
    public onDragLeaveInternal(event) {
        event.preventDefault();
        event.stopPropagation();
        this.onDragLeave.emit();
    }

    @HostListener('drop', ['$event'])
    public onDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            try {
                this.onFileDropped.emit(files)
            } finally {
                this.onDragLeave.emit();
            }
        }
    }
}