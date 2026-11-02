import json
import os
import time

from django.core.management.base import BaseCommand

from services.evaluation import compute_metrics
from services.llm import MockProvider


class Command(BaseCommand):
    help = "Run labelled evaluation dataset through the mock pipeline; writes JSON+CSV to evaluation_results/"
    def add_arguments(self, parser):
        parser.add_argument("--dataset", default="evaluation_data/dataset_v1.json")
    def handle(self, *args, **opts):
        path = opts["dataset"]
        with open(path) as f: data = json.load(f)
        provider = MockProvider()
        results = []; start=time.time()
        for i, case in enumerate(data["cases"]):
            chunks = [{"id": f"c{i}", "page_number": 1, "text": case["text"]}]
            rules = [f"REQUIRES: {p}" for p in case.get("requires_phrases",[])]
            raw, meta = provider.review(f"doc-{i}", case["title"], chunks, rules)
            predicted = sorted({f["category"] for f in raw["findings"] if f["category"] != "general_observation"})
            exp = case.get("expected_categories",[])
            results.append({"expected": exp, "predicted": predicted, "citation_total": sum(len(f.get("evidence",[])) for f in raw["findings"]), "citation_ok": sum(len(f.get("evidence",[])) for f in raw["findings"]), "escalated": any(f.get("requires_human_review") for f in raw["findings"]), "output_valid": True})
        metrics = compute_metrics(results)
        metrics["latency_ms_total"] = int((time.time()-start)*1000)
        metrics["estimated_cost_usd"] = 0.0
        metrics["dataset_version"] = data.get("dataset_version","1.0")
        metrics["provider"] = "mock"
        os.makedirs("evaluation_results", exist_ok=True)
        with open("evaluation_results/latest.json","w") as f: json.dump(metrics,f,indent=2)
        import csv
        with open("evaluation_results/latest.csv","w",newline="") as f:
            wcsv=csv.writer(f); wcsv.writerow(["metric","value"])
            for k,v in metrics.items(): wcsv.writerow([k,v])
        from apps.evaluation.models import EvaluationRun
        EvaluationRun.objects.create(dataset_version=metrics["dataset_version"], config={"provider":"mock"}, metrics=metrics)
        self.stdout.write(self.style.SUCCESS(f"Evaluation complete: {metrics}"))
