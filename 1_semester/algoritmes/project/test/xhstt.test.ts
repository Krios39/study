import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Loader } from "../src/io/loader.ts";
import { Problem } from "../src/core/problem.ts";
import { XhsttReader } from "../src/io/xhstt-reader.ts";
import { Xml } from "../src/io/xml.ts";

const sample = `﻿<?xml version="1.0"?>
<HighSchoolTimetableArchive Id="sample">
  <Instances>
    <Instance Id="TINY">
      <MetaData><Name>Tiny &amp; small</Name><Country>Nowhere</Country></MetaData>
      <Times>
        <TimeGroups><Day Id="d1"><Name>Mo</Name></Day><Day Id="d2"><Name>Tu</Name></Day></TimeGroups>
        <Time Id="t11"><Name>Mo1</Name><Day Reference="d1"/></Time>
        <Time Id="t12"><Name>Mo2</Name><Day Reference="d1"/></Time>
        <Time Id="t21"><Name>Tu1</Name><Day Reference="d2"/></Time>
        <Time Id="t22"><Name>Tu2</Name><Day Reference="d2"/></Time>
      </Times>
      <Resources>
        <ResourceTypes>
          <ResourceType Id="Teacher"><Name>Teacher</Name></ResourceType>
          <ResourceType Id="Class"><Name>Class</Name></ResourceType>
          <ResourceType Id="Room"><Name>Room</Name></ResourceType>
        </ResourceTypes>
        <Resource Id="T1"><Name>T1</Name><ResourceType Reference="Teacher"/></Resource>
        <Resource Id="T2"><Name>T2</Name><ResourceType Reference="Teacher"/></Resource>
        <Resource Id="C1"><Name>C1</Name><ResourceType Reference="Class"/></Resource>
        <Resource Id="R1"><Name>R1</Name><ResourceType Reference="Room"/></Resource>
      </Resources>
      <Events>
        <Event Id="e1"><Name>e1</Name><Duration>2</Duration><Course Reference="math"/>
          <Resources>
            <Resource Reference="C1"><Role>Class</Role><ResourceType Reference="Class"/></Resource>
            <Resource Reference="T1"><Role>Teacher</Role><ResourceType Reference="Teacher"/></Resource>
            <Resource><Role>Room</Role><ResourceType Reference="Room"/></Resource>
          </Resources>
        </Event>
        <Event Id="e2"><Name>e2</Name><Duration>1</Duration>
          <Resources><Resource Reference="C1"><Role>Class</Role><ResourceType Reference="Class"/></Resource></Resources>
        </Event>
        <Event Id="e3"><Name>e3</Name><Duration>1</Duration>
          <Resources><Resource Reference="T2"><Role>Teacher</Role><ResourceType Reference="Teacher"/></Resource></Resources>
        </Event>
      </Events>
      <Constraints>
        <AssignTimeConstraint Id="a"><Required>true</Required></AssignTimeConstraint>
        <AvoidUnavailableTimesConstraint Id="u"><Required>true</Required>
          <AppliesTo><Resources><Resource Reference="T1"/></Resources></AppliesTo>
          <Times><Time Reference="t22"/></Times>
        </AvoidUnavailableTimesConstraint>
        <LimitIdleTimesConstraint Id="i"><Required>false</Required></LimitIdleTimesConstraint>
      </Constraints>
    </Instance>
  </Instances>
</HighSchoolTimetableArchive>`;

describe("XHSTT reader", () => {
  const [node] = XhsttReader.instanceNodes(Xml.parse(sample));
  const { instance, report } = XhsttReader.convert(node);

  it("reads times, resources and events into the model", () => {
    expect(report.id).toBe("TINY");
    expect(report.name).toBe("Tiny & small");
    expect([report.days, report.periodsPerDay, report.times]).toEqual([2, 2, 4]);
    expect(instance!.classes).toEqual([{ id: "C1", grade: 0, firstPeriod: 0, maxPerDay: 2 }]);
    expect(instance!.requirements).toEqual([
      { class: "C1", subject: "math", teachers: ["T1"], hours: 2 },
      { class: "C1", subject: "e2", teachers: ["no-teacher-C1"], hours: 1 },
    ]);
    expect(instance!.teachers).toEqual([{ id: "T1", unavailable: [[1, 1]] }, { id: "no-teacher-C1" }]);
    Loader.validateInstance(instance!);
    expect(Problem.from(instance!).nLessons).toBe(3);
  });

  it("reports what does not fit the model", () => {
    expect(report.eventsSkipped).toEqual({ "no class": 1 });
    expect(report.lessonsSkipped).toBe(1);
    expect(report.unassignedRoles).toBe(1);
    expect(report.otherResources).toEqual({ Room: 1 });
    expect(report.constraintsUsed).toEqual({ AssignTimeConstraint: 1, AvoidUnavailableTimesConstraint: 1 });
    expect(report.constraintsIgnored).toEqual({ "LimitIdleTimesConstraint (soft)": 1 });
  });

  it("rejects broken XML", () => {
    expect(() => Xml.parse("<a><b></a>")).toThrow(/unexpected/);
  });

  const archive = fileURLToPath(new URL("../instances/xhstt/XHSTT-2014.xml", import.meta.url));
  it.skipIf(!existsSync(archive))("reads the public archive", () => {
    const nodes = XhsttReader.instanceNodes(Xml.parse(readFileSync(archive, "utf8")));
    expect(nodes.length).toBe(25);
    const brazil = XhsttReader.convert(nodes.find((n) => n.attributes.Id === "BR-SA-00")!);
    expect([brazil.report.times, brazil.report.classes, brazil.report.teachers, brazil.report.events, brazil.report.lessons]).toEqual([
      25, 6, 14, 63, 150,
    ]);
    Loader.validateInstance(brazil.instance!);
  });
});
