/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.apache.hadoop.examples;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Map;
import java.util.StringTokenizer;
import java.util.TreeMap;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.conf.Configured;
import org.apache.hadoop.fs.FileStatus;
import org.apache.hadoop.fs.FileSystem;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.IntWritable;
import org.apache.hadoop.io.LongWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.hadoop.mapreduce.Reducer;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;
import org.apache.hadoop.util.Tool;
import org.apache.hadoop.util.ToolRunner;

import com.google.common.base.Charsets;

public class WordMedian extends Configured implements Tool {

  private double median = 0;
  private final static LongWritable ONE = new LongWritable(1);

  public static class WordMedianMapper extends
      Mapper<Object, Text, IntWritable, LongWritable> {

    private IntWritable length = new IntWritable();

    public void map(Object key, Text value, Context context)
        throws IOException, InterruptedException {
      StringTokenizer itr = new StringTokenizer(value.toString());
      while (itr.hasMoreTokens()) {
        String string = itr.nextToken();
        length.set(string.length());
        context.write(length, ONE);
      }
    }
  }

  public static class WordMedianReducer extends
      Reducer<IntWritable, LongWritable, IntWritable, LongWritable> {

    private LongWritable val = new LongWritable();

    public void reduce(IntWritable key, Iterable<LongWritable> values,
        Context context) throws IOException, InterruptedException {
      long sum = 0;
      for (LongWritable value : values) {
        sum += value.get();
      }
      val.set(sum);
      context.write(key, val);
    }
  }

  static TreeMap<Integer, Long> readHistogram(Path dir, Configuration conf)
      throws IOException {
    FileSystem fs = dir.getFileSystem(conf);
    FileStatus[] parts = fs.globStatus(new Path(dir, "part-r-*"));
    if (parts == null || parts.length == 0) {
      throw new IOException("Output not found in " + dir);
    }
    TreeMap<Integer, Long> histogram = new TreeMap<Integer, Long>();
    for (FileStatus part : parts) {
      try (BufferedReader br = new BufferedReader(
          new InputStreamReader(fs.open(part.getPath()), Charsets.UTF_8))) {
        String line;
        while ((line = br.readLine()) != null) {
          StringTokenizer st = new StringTokenizer(line);
          if (!st.hasMoreTokens()) {
            continue;
          }
          int len = Integer.parseInt(st.nextToken());
          long count = Long.parseLong(st.nextToken());
          Long prev = histogram.get(len);
          histogram.put(len, prev == null ? count : prev + count);
        }
      }
    }
    return histogram;
  }

  static int valueAtRank(TreeMap<Integer, Long> histogram, long rank) {
    long seen = 0;
    for (Map.Entry<Integer, Long> e : histogram.entrySet()) {
      seen += e.getValue();
      if (seen >= rank) {
        return e.getKey();
      }
    }
    throw new IllegalArgumentException("rank " + rank + " exceeds " + seen);
  }

  static double medianOf(TreeMap<Integer, Long> histogram) {
    long total = 0;
    for (long c : histogram.values()) {
      total += c;
    }
    if (total == 0) {
      return Double.NaN;
    }
    int lower = valueAtRank(histogram, (total + 1) / 2);
    int upper = valueAtRank(histogram, total / 2 + 1);
    return (lower + upper) / 2.0;
  }

  public static void main(String[] args) throws Exception {
    System.exit(ToolRunner.run(new Configuration(), new WordMedian(), args));
  }

  @Override
  public int run(String[] args) throws Exception {
    if (args.length != 2) {
      System.err.println("Usage: wordmedian <in> <out>");
      return 2;
    }

    Configuration conf = getConf();

    Job job = Job.getInstance(conf, "word median");
    job.setJarByClass(WordMedian.class);
    job.setMapperClass(WordMedianMapper.class);
    job.setCombinerClass(WordMedianReducer.class);
    job.setReducerClass(WordMedianReducer.class);
    job.setOutputKeyClass(IntWritable.class);
    job.setOutputValueClass(LongWritable.class);
    FileInputFormat.addInputPath(job, new Path(args[0]));
    FileOutputFormat.setOutputPath(job, new Path(args[1]));
    if (!job.waitForCompletion(true)) {
      return 1;
    }

    median = medianOf(readHistogram(new Path(args[1]), conf));
    System.out.println("The median is: " + median);
    return 0;
  }

  public double getMedian() {
    return median;
  }
}
