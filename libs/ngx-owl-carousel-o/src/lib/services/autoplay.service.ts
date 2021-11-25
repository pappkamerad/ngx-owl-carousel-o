import { Injectable, Inject, OnDestroy, NgZone } from '@angular/core';
import { Subscription, Observable, merge, of } from 'rxjs';
import { tap, switchMap, first, filter } from 'rxjs/operators';

import { CarouselService } from './carousel.service';
import { WINDOW } from './window-ref.service';
import { DOCUMENT } from './document-ref.service';

@Injectable()
export class AutoplayService implements OnDestroy{
  /**
   * Subscrioption to merge Observables from CarouselService
   */
  autoplaySubscription: Subscription;

  /**
   * The autoplay timeout.
   */
  private _timeout: number = null;

  /**
   * Indicates whenever the autoplay is paused.
   */
  private _paused = false;

  /**
   * Shows whether the code (the plugin) changed the option 'AutoplayTimeout' for own needs
   */
  private _isArtificialAutoplayTimeout: boolean;

  /**
   * Shows whether the autoplay is paused for unlimited time by the developer.
   * Use to prevent autoplaying in case of firing `mouseleave` by adding layers to `<body>` like `mat-menu` does
   */
  private _isAutoplayStopped = false;
  get isAutoplayStopped() {
    return this._isAutoplayStopped;
  }
  set isAutoplayStopped(value) {
    this._isAutoplayStopped = value;
  }

  private winRef: Window;
  private docRef: Document;


  constructor(private carouselService: CarouselService,
              @Inject(WINDOW) winRef: any,
              @Inject(DOCUMENT) docRef: any,
              private ngZone: NgZone
  ) {
    this.winRef = winRef as Window;
    this.docRef = docRef as Document;
    this.spyDataStreams();
  }

  ngOnDestroy() {
    this.autoplaySubscription.unsubscribe();
  }

  /**
   * Defines Observables which service must observe
   */
  spyDataStreams() {
    const initializedCarousel$: Observable<string> = this.carouselService.getInitializedState().pipe(
      tap(() => {
        if (this.carouselService.settings.autoplay) {
          this.play();
				}
      })
    );

    const changedSettings$: Observable<any> = this.carouselService.getChangedState().pipe(
      tap(data => {
        this._handleChangeObservable(data);
      })
    );

    const resized$: Observable<any> = this.carouselService.getResizedState().pipe(
      tap(() => {
        if (this.carouselService.settings.autoplay && !this._isAutoplayStopped) {
          this.play();
				} else {
          this.stop();
        }
      })
    )

    // original Autoplay Plugin has listeners on play.owl.core and stop.owl.core events.
    // They are triggered by Video Plugin

    const autoplayMerge$: Observable<string> = merge(initializedCarousel$, changedSettings$, resized$);
    this.autoplaySubscription = autoplayMerge$.subscribe(
      () => {}
    );
  }

  /**
	 * Starts the autoplay.
	 * @param timeout The interval before the next animation starts.
	 * @param speed The animation speed for the animations.
	 */
	play(timeout?: number, speed?: number) {
    if (this._paused) {
			this._paused = false;
			this._setAutoPlayInterval(this.carouselService.settings.autoplayMouseleaveTimeout);
    }

		if (this.carouselService.is('rotating')) {
			return;
		}

    this.carouselService.enter('rotating');

		this._setAutoPlayInterval();
  };

  /**
	 * Gets a new timeout
	 * @param timeout - The interval before the next animation starts.
	 * @param speed - The animation speed for the animations.
	 * @return
	 */
	private _getNextTimeout(timeout?: number, speed?: number): number {
		if ( this._timeout ) {
			this.winRef.clearTimeout(this._timeout);
    }

    this._isArtificialAutoplayTimeout = timeout ? true : false;

		return this.ngZone.runOutsideAngular(() => {
      return this.winRef.setTimeout(() =>{
        this.ngZone.run(() => {
          if (this._paused || this.carouselService.is('busy') || this.carouselService.is('interacting') || this.docRef.hidden) {
            return;
          }
          this.carouselService.next(speed || this.carouselService.settings.autoplaySpeed);
        });
      }, timeout || this.carouselService.settings.autoplayTimeout);
    });

  };

  /**
	 * Sets autoplay in motion.
	 */
  private _setAutoPlayInterval(timeout?: number) {
		this._timeout = this._getNextTimeout(timeout);
	};

	/**
	 * Stops the autoplay.
	 */
	stop() {
		if (!this.carouselService.is('rotating')) {
			return;
		}
    this._paused = true;

		this.winRef.clearTimeout(this._timeout);
		this.carouselService.leave('rotating');
  };

  /**
	 * Stops the autoplay.
	 */
	pause() {
		if (!this.carouselService.is('rotating')) {
			return;
		}

		this._paused = true;
  };

  /**
   * Manages by autoplaying according to data passed by _changedSettingsCarousel$ Obsarvable
   * @param data object with current position of carousel and type of change
   */
  private _handleChangeObservable(data: any) {
    if (data.property.name === 'settings') {
      if (this.carouselService.settings.autoplay) {
        this.play();
      } else {
        this.stop();
      }
    } else if (data.property.name === 'position') {
      //console.log('play?', e);
      if (this.carouselService.settings.autoplay) {
        this._setAutoPlayInterval();
      }
    }
  }

  /**
   * Starts autoplaying of the carousel in the case when user leaves the carousel before it starts translateing (moving)
   */
  private _playAfterTranslated() {
    of('translated').pipe(
      switchMap(data => this.carouselService.getTranslatedState()),
      first(),
      filter(() => this._isArtificialAutoplayTimeout),
      tap(() => this._setAutoPlayInterval())
    ).subscribe(() => { });
  }

  /**
   * Starts pausing
   */
  startPausing() {
    if (this.carouselService.settings.autoplayHoverPause && this.carouselService.is('rotating')) {
      this.pause();
    }
  }

  /**
   * Starts playing after mouse leaves carousel
   */
  startPlayingMouseLeave() {
    if (this.carouselService.settings.autoplayHoverPause && this.carouselService.is('rotating')) {
      this.play();
      this._playAfterTranslated();
    }
  }

  /**
   * Starts playing after touch ends
   */
  startPlayingTouchEnd() {
    if (this.carouselService.settings.autoplayHoverPause && this.carouselService.is('rotating')) {
      this.play();
      this._playAfterTranslated();
    }
  }
}
