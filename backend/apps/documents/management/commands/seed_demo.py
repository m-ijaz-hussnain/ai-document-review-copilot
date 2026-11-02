import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.models import Organization
from apps.policies.models import ReviewPolicy, ReviewPolicyVersion

User = get_user_model()
class Command(BaseCommand):
    help = "Create demo org, users, policies (LOCAL DEMO ONLY - change passwords immediately outside local use)"
    def handle(self, *args, **opts):
        org, _ = Organization.objects.get_or_create(slug="demo-org", defaults={"name": "Demo Organization"})
        pw = os.environ.get("DEMO_PASSWORD", "DemoPass123!")
        for username, role in [("admin","admin"),("reviewer","reviewer"),("uploader","uploader")]:
            u, created = User.objects.get_or_create(username=username, defaults={"organization": org, "role": role, "email": f"{username}@demo.local"})
            u.organization = org; u.role = role
            if created: u.set_password(pw)
            u.save()
        p1, _ = ReviewPolicy.objects.get_or_create(organization=org, name="Data Protection Policy Review", defaults={"description": "Checks data protection essentials"})
        ReviewPolicyVersion.objects.get_or_create(policy=p1, version="1.0", defaults={"rules": {"requires_phrases": ["data retention period","data protection officer"]}, "checklist": ["retention defined","DPO named"]})
        p2, _ = ReviewPolicy.objects.get_or_create(organization=org, name="Vendor Contract Checklist", defaults={"description": "Checks vendor contract essentials"})
        ReviewPolicyVersion.objects.get_or_create(policy=p2, version="1.0", defaults={"rules": {"requires_phrases": ["termination clause","liability cap"]}, "checklist": ["termination defined","liability capped"]})
        self.stdout.write(self.style.SUCCESS("Seed complete. Org: demo-org. Users: admin/reviewer/uploader (password from DEMO_PASSWORD env, default documented in README for local demo only)."))
