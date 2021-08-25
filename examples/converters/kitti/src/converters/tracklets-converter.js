// Copyright (c) 2019 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* eslint-disable camelcase */
import fs from 'fs';
import path from 'path';
import {
  _getObjectTrajectory as getObjectTrajectory,
  _getRelativeCoordinates as getRelativeCoordinates
} from '@xviz/builder';

import { loadTracklets } from '../parsers/parse-tracklets';
import { MOTION_PLANNING_STEPS } from './constant';

export default class TrackletsConverter {
  constructor(directory, getPoses) {
    this.rootDir = directory;
    this.trackletFile = path.join(directory, 'tracklet_labels.xml');
    this.getPoses = getPoses;

    // laser scanner relative to GPS position
    // http://www.cvlibs.net/datasets/kitti/setup.php

    // this.FIXTURE_TRANSFORM_POSE = {
    //   x: 0.81,
    //   y: -5.32,
    //   z: 1.73
    // };
    this.FIXTURE_TRANSFORM_POSE = {
      x: 0,
      y: 0,
      z: 0
    };

    this.TRACKLETS = '/tracklets/objects';
    this.TRACKLETS_TRAJECTORY = '/tracklets/trajectory';
    this.TRACKLETS_TRACKING_POINT = '/tracklets/tracking_point';
    this.TRACKLETS_LABEL = '/tracklets/label';
  }

  load() {
    if (!fs.existsSync(this.trackletFile)) {
      this.trackletFile = null;
      return;
    }

    const xml = fs.readFileSync(this.trackletFile, 'utf8');
    this.data = loadTracklets(xml);

    this.frameStart = this.data.objects.reduce(
      (minFrame, obj) => Math.min(minFrame, obj.firstFrame),
      Number.MAX_SAFE_INTEGER
    );

    this.frameLimit = this.data.objects.reduce(
      (maxFrame, obj) => Math.max(maxFrame, obj.lastFrame),
      0
    );

    if (this.frameStart > this.frameLimit) {
      throw new Error('Invalid frame range');
    }

    this.trackletFrames = new Map();

    // Convert tracklets upfront to support trajectory
    for (let i = this.frameStart; i < this.frameLimit; i++) {
      this.trackletFrames.set(i, this._convertTrackletsFrame(i));
    }

    // tracklets trajectory is in pose relative coordinate
    this.poses = this.getPoses();
  }

  async convertMessage(messageNumber, xvizBuilder) {
    if (!this.trackletFile) {
      return;
    }

    if (messageNumber < this.frameStart || messageNumber >= this.frameLimit) {
      return;
    }

    const tracklets = this.trackletFrames.get(messageNumber);
    tracklets.forEach(tracklet => {
      // Here you can see how the *classes* are used to tag the object
      // allowing for the *style* information to be shared across
      // categories of objects.
      // console.log(tracklet)

      xvizBuilder
        .primitive(this.TRACKLETS)
        .polygon(tracklet.vertices)
        .classes(tracklet.label) // TODO: Each pose has label 
        .style({
          height: tracklet.height
        })
        .id(`${tracklet.id}`);

      xvizBuilder
        .primitive(this.TRACKLETS_TRACKING_POINT)
        .circle([tracklet.x, tracklet.y, tracklet.z], 0)
        .id(`${tracklet.id}`);

      xvizBuilder
        .primitive(this.TRACKLETS_LABEL)
        .text(`${tracklet.label}`)
        .position([tracklet.x, tracklet.y, tracklet.z])
        .style({ text_anchor: 'START', text_size:0 })
        .id(`${tracklet.id}`);

        xvizBuilder
        .primitive(this.TRACKLETS_LABEL)
        .text(`${parseInt(tracklet.confidence * 100)}`)
        .position([tracklet.x, tracklet.y, tracklet.z])
        .style({ text_anchor: 'START', text_size:0 })
        .id(`${tracklet.id}`);

        xvizBuilder
        .primitive(this.TRACKLETS_LABEL)
        .text(parseInt(tracklet.objectId))
        .position([tracklet.x, tracklet.y, tracklet.z])
        .style({ text_anchor: 'START', text_size:0 })
        .id(`${tracklet.id}`);





      //console.log(tracklet.label)
      // xvizBuilder
      //   .primitive(this.TRACKLETS_LABEL)
      //   // float above the object
      //   .position([tracklet.x, tracklet.y, tracklet.z + 3])
      //   // .text(tracklet.id.slice(24));
      //   .text(tracklet.label);
      // tracklet.trackletId=tracklet.data.id;
      // tracklet.confidance  = parseInt(tracklet.confidence*100);

    });

    // object is in this frame
    this.data.objects
      .filter(object => messageNumber >= object.firstFrame && messageNumber < object.lastFrame)
      .forEach(object => {
        //console.log(object.data.id)
        const objectTrajectory = getObjectTrajectory({
          targetObject: object,
          objectFrames: this.trackletFrames,
          poseFrames: this.poses,
          startFrame: messageNumber,
          //objectId:object.data.id,
          endFrame: Math.min(
            messageNumber + MOTION_PLANNING_STEPS,
            object.lastFrame,
            this.frameLimit
          )
        });

        xvizBuilder.primitive(this.TRACKLETS_TRAJECTORY).polyline(objectTrajectory);
      });
  }

  getMetadata(xvizMetaBuilder) {
    const xb = xvizMetaBuilder;
    xb.stream(this.TRACKLETS)
      .category('primitive')
      .type('polygon')
      .coordinate('VEHICLE_RELATIVE')
      .streamStyle({
        extruded: true,
        fill_color: '#eeeeee80',
        height: 2.5
      })
      .styleClass('Vehicles', {
        fill_color: '#50B3FF80',
        stroke_color: '#50B3FF',
        height: 2.5
      })
      .styleClass('2Wheels', {
        fill_color: '#957FCE80',
        stroke_color: '#957FCE',
        height: 2.5
      })
      .styleClass('Walkers', {
        fill_color: '#FFC6AF80',
        stroke_color: '#FFC6AF',
        height: 2.5
      })
      .styleClass('Van', {
        fill_color: '#5B91F480',
        stroke_color: '#5B91F4',
        height: 2.5
      })
      .styleClass('Shit', {
        fill_color: '#E2E2E280',
        stroke_color: '#E2E2E2',
        height: 2.5
      })
      .pose(this.FIXTURE_TRANSFORM_POSE)

      .stream(this.TRACKLETS_TRACKING_POINT)
      .category('primitive')
      .type('circle')
      .streamStyle({
        radius: 0,
        stroke_width: 0,
        fill_color: '#FFC043'
      })
      .coordinate('VEHICLE_RELATIVE')
      .pose(this.FIXTURE_TRANSFORM_POSE)

      .stream(this.TRACKLETS_LABEL)
      .category('primitive')
      .type('text')
      .streamStyle({
        text_size: 18,
        fill_color: '#DCDCCD'
      })
      .coordinate('VEHICLE_RELATIVE')
      .pose(this.FIXTURE_TRANSFORM_POSE)

      .stream(this.TRACKLETS_TRAJECTORY)
      .category('primitive')
      .type('polyline')
      .streamStyle({
        stroke_color: '#FFC043',
        stroke_width: 0.1,
        stroke_width_min_pixels: 1
      })
      .coordinate('VEHICLE_RELATIVE')
      .pose(this.FIXTURE_TRANSFORM_POSE);

  }

  _convertTrackletsFrame(frameIndex) {
    // filter objects exist in given frame
    return this.data.objects
      .filter(object => frameIndex >= object.firstFrame && frameIndex < object.lastFrame)
      .map(object => {
        const poseIndex = frameIndex - object.firstFrame;

        const pose = Array.isArray(object.data.poses.item)
          ? object.data.poses.item[poseIndex]
          : object.data.poses.item;

        const { tx, ty, tz, rx, ry, rz, label, h, w, l, confidence } = pose;
        const poseProps = { //TODO: add label from each pose
          label: label,
          x: Number(tx),
          y: Number(ty),
          z: Number(tz),
          roll: Number(rx),
          pitch: Number(ry),
          yaw: Number(rz),
          h: Number(h),
          w: Number(w),
          l: Number(l),
          confidence: Number(confidence),
          objectId:Number(object.data.id)
        };

        const bounds = [ //TODO:needs to be done each frame
          [-poseProps.l / 2, -poseProps.w / 2, 0],
          [-poseProps.l / 2, poseProps.w / 2, 0],
          [poseProps.l / 2, poseProps.w / 2, 0],
          [poseProps.l / 2, -poseProps.w / 2, 0],
          [-poseProps.l / 2, -poseProps.w / 2, 0]
        ];

        return {
          ...object,
          ...poseProps,
          vertices: getRelativeCoordinates(bounds, poseProps) //TODO: each pose has fresh bounds
        };
      });
  }
}
