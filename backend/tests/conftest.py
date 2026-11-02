import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from apps.accounts.models import Organization

User = get_user_model()

def make_user(org, username, role):
    u = User.objects.create_user(username=username, password="TestPass123!", organization=org, role=role)
    return u
def auth_client(user):
    token, _ = Token.objects.get_or_create(user=user)
    c = APIClient(); c.credentials(HTTP_AUTHORIZATION=f"Token {token.key}"); return c

@pytest.fixture
def org(db): return Organization.objects.create(name="Org A", slug="org-a")
@pytest.fixture
def org2(db): return Organization.objects.create(name="Org B", slug="org-b")
@pytest.fixture
def admin_user(db, org): return make_user(org, "admin1", "admin")
@pytest.fixture
def reviewer(db, org): return make_user(org, "rev1", "reviewer")
@pytest.fixture
def uploader(db, org): return make_user(org, "up1", "uploader")
@pytest.fixture
def other_org_user(db, org2): return make_user(org2, "outsider", "admin")
