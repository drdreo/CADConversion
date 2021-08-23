import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../environments/environment';

@Injectable({
	providedIn: 'root'
})
export class FilesService {
	constructor(private http: HttpClient) {}

	getUserFiles(): Observable<any> {
		return this.http.get<any>(environment.conversionAPI + '/files').pipe(map(res => res.files));
	}

	uploadFiles(formData: FormData): Promise<any> {
		return this.http.post(environment.conversionAPI + '/upload', formData).toPromise();
	}

	downloadFile(fileName: string) {
		return this.http.get(environment.conversionAPI + '/files/download/' + fileName, {
			responseType: 'blob'
		}).toPromise();
	}
}
