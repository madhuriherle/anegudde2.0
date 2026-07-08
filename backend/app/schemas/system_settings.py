from pydantic import BaseModel, ConfigDict, Field, model_validator
from datetime import datetime
from typing import Optional

class SystemSettingsBase(BaseModel):
    temple_name: Optional[str] = None
    temple_name_kn: Optional[str] = None
    temple_subtitle: Optional[str] = None
    temple_address: Optional[str] = None
    temple_contact: Optional[str] = None
    alternate_contact: Optional[str] = None
    receipt_office_contact: Optional[str] = None
    receipt_seva_counter_contact: Optional[str] = None
    receipt_guest_house_contact: Optional[str] = None
    temple_email: Optional[str] = None
    temple_website: Optional[str] = None
    temple_logo: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    google_maps_link: Optional[str] = None
    footer_note: Optional[str] = None
    receipt_padding: int = 4
    receipt_top_offset: float = Field(default=0.0, ge=-50, le=50)
    receipt_left_offset: float = Field(default=0.0, ge=-50, le=50)
    token_file_path: Optional[str] = None
    
    # Display Toggles
    show_temple_logo: bool = True
    show_temple_name: bool = True
    show_temple_name_kn: bool = True
    show_temple_address: bool = True
    show_temple_contact: bool = True
    show_alternate_contact: bool = True
    show_temple_email: bool = True
    show_temple_website: bool = True
    show_temple_timings: bool = True
    show_google_maps_link: bool = True

    @model_validator(mode='after')
    def check_names(self) -> 'SystemSettingsBase':
        if not self.temple_name and not self.temple_name_kn:
            raise ValueError('At least one temple name (English or Kannada) is required')
        return self

class SystemSettingsUpdate(SystemSettingsBase):
    pass

class TempleIdentitySettingsUpdate(BaseModel):
    temple_name: Optional[str] = None
    temple_name_kn: Optional[str] = None
    temple_address: Optional[str] = None
    temple_contact: Optional[str] = None
    alternate_contact: Optional[str] = None
    receipt_office_contact: Optional[str] = None
    receipt_seva_counter_contact: Optional[str] = None
    receipt_guest_house_contact: Optional[str] = None
    temple_email: Optional[str] = None
    temple_website: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    google_maps_link: Optional[str] = None
    temple_logo: Optional[str] = None
    footer_note: Optional[str] = None
    show_temple_logo: bool = True
    show_temple_name: bool = True
    show_temple_name_kn: bool = True
    show_temple_address: bool = True
    show_temple_contact: bool = True
    show_alternate_contact: bool = True
    show_temple_email: bool = True
    show_temple_website: bool = True
    show_temple_timings: bool = True
    show_google_maps_link: bool = True

    @model_validator(mode='after')
    def check_names(self) -> 'TempleIdentitySettingsUpdate':
        if not self.temple_name and not self.temple_name_kn:
            raise ValueError('At least one temple name (English or Kannada) is required')
        return self

class ReceiptSettingsUpdate(BaseModel):
    receipt_padding: int
    receipt_top_offset: float = Field(default=0.0, ge=-50, le=50)
    receipt_left_offset: float = Field(default=0.0, ge=-50, le=50)
    show_temple_logo: bool = True
    show_temple_name: bool = True
    show_temple_name_kn: bool = True
    show_temple_address: bool = True
    show_temple_contact: bool = True
    show_alternate_contact: bool = True
    show_temple_email: bool = True
    show_temple_website: bool = True
    show_temple_timings: bool = True
    show_google_maps_link: bool = True

class TempleIdentitySettingsOut(BaseModel):
    temple_name: Optional[str] = None
    temple_name_kn: Optional[str] = None
    temple_address: Optional[str] = None
    temple_contact: Optional[str] = None
    alternate_contact: Optional[str] = None
    receipt_office_contact: Optional[str] = None
    receipt_seva_counter_contact: Optional[str] = None
    receipt_guest_house_contact: Optional[str] = None
    temple_email: Optional[str] = None
    temple_website: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    google_maps_link: Optional[str] = None
    temple_logo: Optional[str] = None
    footer_note: Optional[str] = None
    show_temple_logo: bool = True
    show_temple_name: bool = True
    show_temple_name_kn: bool = True
    show_temple_address: bool = True
    show_temple_contact: bool = True
    show_alternate_contact: bool = True
    show_temple_email: bool = True
    show_temple_website: bool = True
    show_temple_timings: bool = True
    show_google_maps_link: bool = True
    updated_at: datetime
    updated_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ReceiptSettingsOut(BaseModel):
    temple_name: Optional[str] = None
    temple_name_kn: Optional[str] = None
    temple_address: Optional[str] = None
    temple_contact: Optional[str] = None
    alternate_contact: Optional[str] = None
    receipt_office_contact: Optional[str] = None
    receipt_seva_counter_contact: Optional[str] = None
    receipt_guest_house_contact: Optional[str] = None
    temple_email: Optional[str] = None
    temple_website: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    google_maps_link: Optional[str] = None
    temple_logo: Optional[str] = None
    footer_note: Optional[str] = None
    receipt_padding: int
    receipt_top_offset: float = 0.0
    receipt_left_offset: float = 0.0
    show_temple_logo: bool = True
    show_temple_name: bool = True
    show_temple_name_kn: bool = True
    show_temple_address: bool = True
    show_temple_contact: bool = True
    show_alternate_contact: bool = True
    show_temple_email: bool = True
    show_temple_website: bool = True
    show_temple_timings: bool = True
    show_google_maps_link: bool = True
    updated_at: datetime
    updated_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class DataCleanupSettingsOut(BaseModel):
    updated_at: datetime
    updated_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class SystemSettingsOut(SystemSettingsBase):
    id: int
    current_financial_year_id: Optional[int] = None
    financial_year_name: Optional[str] = None
    updated_at: datetime
    updated_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
