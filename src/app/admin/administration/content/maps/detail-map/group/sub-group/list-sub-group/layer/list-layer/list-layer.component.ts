import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Params, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { NotifierService } from 'angular-notifier';
import { MapsService } from '../../../../../../../../service/maps.service'
import {manageCompHelper} from '../../../../../../../../../../../helper/manage-comp.helper'
import { Layer } from '../../../../../../../../../../type/type';
import { EMPTY, merge, Observable, of, ReplaySubject, Subject } from 'rxjs';
import { filter, switchMap, catchError, tap, startWith, withLatestFrom, map, takeUntil, take } from 'rxjs/operators';
import { AddLayerComponent } from '../add-layer/add-layer.component';
import { DetailLayerComponent } from '../detail-layer/detail-layer.component';
@Component({
  selector: 'app-list-layer',
  templateUrl: './list-layer.component.html',
  styleUrls: ['./list-layer.component.scss']
})
/**
 * list all layers of a sub group
 */
export class ListLayerComponent implements OnInit {
  
  onAddInstance:()=>void
  onSelectInstance:(layer:Layer)=>void
  onDeleteInstance:(layer:Layer)=>void

  layerList:Observable<Layer[]>

  sub_id:ReplaySubject<number>= new ReplaySubject(1)

  displayedColumns:Array<string> =['square_icon','name','detail']
  

  private readonly notifier: NotifierService;
  constructor(
    public MapsService: MapsService,
    public route: ActivatedRoute,
    public router:Router,
    notifierService: NotifierService,
    public dialog: MatDialog,
    public manageCompHelper:manageCompHelper,
    public translate: TranslateService,
  ) {

    this.notifier = notifierService;
    const onAdd:Subject<void> = new Subject<void>()
    this.onAddInstance = ()=>{
      onAdd.next()
    }

    const onDelete:Subject<Layer> = new Subject<Layer>()
    this.onDeleteInstance = (layer:Layer)=>{
      onDelete.next(layer)
    }

    const onSelect:Subject<Layer>=new Subject<Layer>()

    this.layerList = merge(
      this.router.events.pipe(
        startWith(undefined),
        filter(e => e instanceof NavigationEnd || e == undefined),
        map(() => this.route.snapshot),
        map(route => {
          while (route.firstChild) {
            route = route.firstChild;
          }
          return route;
        }),
        filter((route)=>route.component["name"]==="ListLayerComponent"),
        filter((route) =>route.params['sub-id'] != undefined),
        switchMap((route: ActivatedRouteSnapshot) => {
          let parameters = route.params
          this.sub_id.next(Number(parameters['sub-id']))
          return this.MapsService.getAllLayersFromSubGroup(Number(parameters['sub-id'])).pipe(
            catchError(() => { this.notifier.notify("error", "An error occured while loading layers "); return EMPTY }),
          )
        }),
      ),
      onAdd.pipe(
        withLatestFrom(this.sub_id),
        switchMap((parameters:[void,number])=>{
          return this.dialog.open(AddLayerComponent,{data:parameters[1],width: '90%', maxWidth: '90%', maxHeight: '90%',}).afterClosed().pipe(
            filter(response=>response),
            switchMap(()=>{
              return this.MapsService.getAllLayersFromSubGroup(parameters[1]).pipe(
                catchError(() => { this.notifier.notify("error", "An error occured while loading layers "); return EMPTY }),
              )
            })
          )
        })
        
      ),
      onDelete.pipe(
        switchMap((layer: Layer) => {
          return this.manageCompHelper.openConfirmationDialog([],
            {
              confirmationTitle: this.translate.instant('list_layer.delte_layer'),
              confirmationExplanation: this.translate.instant('admin.vector_provider.delete_confirmation_explanation') + layer.name + ' ?',
              cancelText: this.translate.instant('cancel'),
              confirmText: this.translate.instant('delete'),
            }
          ).pipe(
            filter(resultConfirmation => resultConfirmation),
            switchMap(()=>{
              return this.MapsService.deleteLayer(layer.layer_id).pipe(
                catchError(() => { this.notifier.notify("error", "An error occured while deleting a layer "); return EMPTY }),
                withLatestFrom(this.sub_id),
                switchMap((parameters)=>{
                  return this.MapsService.getAllLayersFromSubGroup(parameters[1]).pipe(
                    catchError(() => { this.notifier.notify("error", "An error occured while loading layers "); return EMPTY }),
                  )
                })
              )
            })
          )
        })
      )
    )

    this.onSelectInstance = (layer:Layer)=>{
      onSelect.next(layer)
    }

    onSelect.pipe(
      tap((layer:Layer)=>{
        this.dialog.open(DetailLayerComponent,{data:layer.layer_id,width: '90%', maxWidth: '90%', maxHeight: '90%',})
      })
    ).subscribe()
  }

  ngOnInit(): void {
  }

}
