from django.contrib import admin

from .models import Organization, User

admin.site.register(User); admin.site.register(Organization)
