import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { FileUploadControl } from '@iplab/ngx-file-upload';
import FileSaver from 'file-saver';
import { Subject, Observable } from 'rxjs';
import { takeUntil, filter, switchMap } from 'rxjs/operators';
import { FilesService } from '../../files.service';

@Component({
	selector: 'app-files',
	templateUrl: './files.component.html',
	styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit, AfterViewInit, OnDestroy {

	fileUploadControl = new FileUploadControl(null);

	files$: Observable<any>;
	fetchFiles$ = new Subject();

	private unsubscribe$ = new Subject();

	constructor(public auth: AuthService, private filesService: FilesService) {

		this.files$ = this.fetchFiles$.pipe(
			switchMap(() => {
				console.log('switching');
				return this.filesService.getUserFiles();
			})
		);
	}

	ngOnInit() {
		this.fileUploadControl.valueChanges
			.pipe(
				filter(files => files && files.length > 0),
				takeUntil(this.unsubscribe$))
			.subscribe((files: Array<File>) => this.uploadFiles(files));
	}

	ngAfterViewInit() {
		this.fetchFiles$.next(true);
	}

	ngOnDestroy() {
		this.unsubscribe$.next();
		this.unsubscribe$.complete();
	}

	clearUpload(): void {
		this.fileUploadControl.clear();
	}


	private uploadFiles(files: any) {
		console.log(files);
		const formData = new FormData();
		for (const file of files) {
			formData.append('uploads[]', file, file.name);
		}

		this.filesService.uploadFiles(formData).then(result => {
			console.log('Upload Response ', result);

			this.fetchFiles$.next();
		}).catch(e => {
			console.error('Error while uploading: ', e);
		});
	}

	requestFileDownload(fileName: string) {
		this.filesService.downloadFile(fileName)
			.then(response => {
				this.downloadFile(fileName, response);
			})
			.catch(err => {
				console.log(err);
			});
	}

	private downloadFile(fileName: string, data: any) {
		console.log('downloadFile', data);
		const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
		// const url = window.URL.createObjectURL(blob);
		// window.open(url, '_self');

		FileSaver.saveAs(blob, fileName);
	}
}
