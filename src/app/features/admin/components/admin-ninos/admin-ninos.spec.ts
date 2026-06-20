import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminNinos } from './admin-ninos';

describe('AdminNinos', () => {
  let component: AdminNinos;
  let fixture: ComponentFixture<AdminNinos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminNinos],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNinos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
