import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminMetricas } from './admin-metricas';

describe('AdminMetricas', () => {
  let component: AdminMetricas;
  let fixture: ComponentFixture<AdminMetricas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMetricas],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMetricas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
